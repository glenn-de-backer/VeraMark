# AGENTS.md

## Project Overview
VeraMark is a Windows desktop application built with **Tauri v2** (Rust backend) and a **Vite + React 18 + TypeScript (strict) + Tailwind CSS v4** frontend. It overlays configurable AI-attribution labels (SVG/PNG badges) onto images and embeds cryptographically **signed** C2PA / CAI (Coalition for Content Provenance and Authenticity) provenance manifests.

It supports two processing modes — single-image granular editing and parallel batch directory processing — on a strict split-pane UI. The live canvas preview applies the exact same transform math as the Rust compositor, so **preview == export** (WYSIWYG). C2PA embedding is **opt-in** (off by default); VeraMark never emits an unsigned claim.

---

## Core Architecture & Tech Stack

```text
┌────────────────────────────────────────────────────────┐
│            Frontend (Vite + React + TypeScript)        │
│  - Split-pane UI: AppHeader / AssetPanel / Preview     │
│    Canvas / InspectorPanel                             │
│  - Styling Engine (Tailwind CSS v4 + @tailwindcss/vite)│
│  - Reactive state (Zustand) + action hooks             │
│  - Typed IPC bridge (services/tauri.ts)                │
└───────────────────────────┬────────────────────────────┘
                            │ Tauri IPC (invoke / events)
┌───────────────────────────▼────────────────────────────┐
│                    Rust Backend (Core)                 │
│  - commands/  Tauri IPC entry points                   │
│  - engine/    compositor, encoder, loader,             │
│               c2pa_signer, batch_runner (rayon)        │
│  - models.rs  serde structs mirrored in TS             │
└────────────────────────────────────────────────────────┘
```

- **Runtime & Shell:** Tauri v2 (Rust backend, WebView2; mobile entry-point in `lib.rs::run`)
- **Frontend Core:** Vite 6, React 18, TypeScript (strict, no `any`), Tailwind CSS v4 via `@tailwindcss/vite`, Zustand 5
- **Native dialogs / files:** `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs`
- **Image Compositing:** Rust `image` crate (8-/16-bit RGBA, ICC) with `usvg` + `resvg`/`tiny-skia` for SVG rasterization. Live preview is plain HTML5 **Canvas 2D** (+ `devicePixelRatio`) — no WebGPU.
- **Provenance & Watermarking:** c2pa-rs (`Builder` API, `ps256` local signer)
- **Concurrency:** `rayon` parallel batch + `tauri::async_runtime::spawn_blocking` to keep the UI responsive
- **Asset Watching:** `notify` crate; `env_logger` for backend logging

---

## User Interface (UI/UX) Layout

Strict split-pane layout built from Tailwind utility classes and the reusable `components/ui/*` primitives:

* **AppHeader (top bar):** brand + `VeraMarkIcon`, Single/Batch mode toggle, and per-mode actions — open/export image in Single; input dir / output dir / "Export all" in Batch; About dialog. Controls disable while a batch runs.
* **Left rail — `AssetPanel`:** `LabelCatalog` (3-column grid of SVG/PNG badges, refresh button + directory path, live reload on `labels-changed`) and the collapsible **"Placement & transform"** panel (anchor picker, scale, X/Y offset sliders).
* **Center viewport — `PreviewCanvas`:**
  * Single mode → `OverlayCanvas` (Canvas 2D WYSIWYG preview + device-pixel-ratio scaling).
  * Batch mode → `BatchGallery` (virtualized lazy grid; 320px thumbnails with an LRU-capped cache and in-flight de-dupe).
  * Status bar shows file name, original dimensions, and a live C2PA manifest readout; a progress bar overlays the viewport during batch.
* **Right rail — `InspectorPanel`:** `ProvenancePanel` (C2PA toggle, claim generator name/version, "trained on my data", PEM key/cert pickers, live signer-validity badge, verify manifest) and `ExportPanel` (format + JPEG quality).

---

## Tauri IPC Contract

Every Rust command argument/return struct uses `#[serde(rename_all = "camelCase")]` and is mirrored **1:1** by a TypeScript interface in `services/tauri.ts` (and `models/*`). Adding a command requires three coordinated edits: a `#[tauri::command]` in `commands/`, registration in `lib.rs`'s `invoke_handler`, and a typed wrapper in `services/tauri.ts`.

### Commands (registered in `lib.rs`)
| Domain | Commands |
| --- | --- |
| Labels | `load_labels`, `refresh_labels`, `watch_labels` |
| Export | `preview_image`, `process_and_export` |
| Batch | `list_batch_images`, `process_batch_directory` |
| Provenance | `read_manifest`, `validate_signer` |
| Settings | `load_settings`, `save_settings` |

### Events (Rust `Emitter` → frontend `listen`)
- `batch-progress` → `BatchProgress` (`done`, `total`, `current`)
- `batch-complete` → `BatchResult` (`processed`, `failed`, `outputs`, `errors`)
- `labels-changed` → triggers a label catalog refresh

---

## Design Patterns & Standards

### Frontend Patterns
* **Observer / Store:** single Zustand store (`stores/useVeraMarkStore.ts`) holding mode, label catalog, transform, export/C2PA settings, single + batch state, and status/progress. Offsets are clamped ≥ 0 in `setTransform`.
* **Adapter (`C2paManifestAdapter`):** `services/c2pa.ts` — `buildManifestInput` normalizes UI provenance settings into backend `C2paSettings`; `isSigningConfigured` enforces the signing guard before IPC.
* **Action hook:** `hooks/useImageActions.ts` centralizes open/export/batch orchestration (native dialogs + IPC + error/status handling) so header and empty-state UIs never duplicate it.
* **Typed IPC bridge:** `services/tauri.ts` wraps every `invoke` with explicit generics and payload types.
* **Component abstraction:** reusable `ui/` primitives (`Button`, `Slider`, `Select`, `Toggle`, `Panel`, `Spinner`, `VeraMarkIcon`) keep main views declarative.
* **WYSIWYG geometry:** `utils/transform.ts::computeOverlayRect` is mirrored **exactly** by Rust `engine/compositor.rs::compute_overlay_rect` (including JS-compatible `Math.round` half-up semantics). Always keep the two in sync.

### Backend (Rust) Patterns
* **Command Pattern:** isolated Tauri commands under `commands/` as IPC boundaries (`labels`, `export`, `batch`, `provenance`, `settings`).
* **Pipeline / Chain of Responsibility:** shared `process_one_file` implements `Load Source → Compose (apply label geometry) → Encode → (optional) Inject C2PA manifest → Write to Disk`. It is reused by single-image export and by `batch_runner::run_batch`.
* **Async offload:** heavy work runs in `spawn_blocking`; progress is emitted via Tauri events so the UI thread is never blocked.
* **Shared single-file path:** `commands/export.rs::process_one_file` is the single source of truth for both modes, guaranteeing identical output.

---

## Technical Specifications & Features

### 1. Label Asset Management
- **Directory resolution** (`engine/loader.rs::resolve_labels_dir`): `VERAMARK_LABELS_DIR` env var wins, then `assets/labels`, `../assets/labels`, `../../assets/labels`, and an exe-relative `assets/labels`.
- Only `*.svg` / `*.png` files are registered; each is sent to the UI as a base64 `data:` URL keyed by its file name (`LabelAsset.id`).
- **Dynamic catalog:** a `notify` watcher (`watch_labels` → `setup_label_watcher`) emits `labels-changed` on create/modify/remove so the catalog refreshes at runtime.

### 2. Label Positioning & Transform
- **Base anchors:** 7 cardinal positions — `TopLeft`, `TopCenter`, `TopRight`, `Center`, `BottomLeft`, `BottomCenter`, `BottomRight`.
- **Scale:** normalized 0.01–1.0 relative to `min(imageW, imageH)`; label width = `min(imageW, imageH) × scale`, with height preserving aspect ratio.
- **Offset:** non-negative pixel magnitudes that always push toward the image interior (clamped ≥ 0; slider bounded by `MAX_OFFSET_PX = 500`). The rect is clamped fully on-canvas.
- SVG labels rasterize with `usvg` + `resvg`/`tiny-skia` (Lanczos3 for PNG) at the exact target size, matching how an `<img>` fills the preview rect.

### 3. Processing Modes
- **Single Image:** open via native dialog, read the preview + any existing C2PA manifest, live overlay preview, export via save dialog (default `<stem>-marked.<ext>`).
- **Batch Directory:** pick input + output dirs; transform controls lock while running; `batch_runner` processes supported images (`png`/`jpg`/`jpeg`/`webp`/`bmp`/`tiff`/`gif`) in parallel with `rayon`, writing `<stem>-marked.<ext>`, and emits `batch-progress` every 5 files plus a final `batch-complete` summary.

### 4. C2PA / CAI Watermarking & Provenance
- **Opt-in** (disabled by default). Requires a PEM private key + signing certificate; signer is **PS256** local (`engine/c2pa_signer.rs::embed_manifest`).
- Manifest includes `c2pa.created` / `c2pa.edited` action assertions, claim-generator info, an IPTC digital-source type (`trainedAlgorithmicMedia` vs `algorithmicMedia`), and an extra `c2pa.trained` assertion when "trained on data" is flagged. Injection is **atomic** (temp file + rename).
- **`read_manifest`** summarizes the active manifest; `signatureValid` is `Some(true)` for `Valid`/`Trusted` validation states, `None` (unverified) when the credential lacks a known trust anchor, `Some(false)` on breakage.
- **`validate_signer`** loads the key/cert pair into the same C2PA settings builder to drive the live validity badge — no image I/O.

### 5. Image Export Engine
- `engine/compositor.rs` preserves source depth (8-bit vs 16-bit RGBA) and ICC profile; `engine/encoder.rs` encodes.
- **PNG:** lossless, preserves 8/16-bit depth, alpha, and best-effort ICC (extracted from PNG/JPEG sources).
- **JPEG:** quality 1–100, alpha blended onto white.
- C2PA JUMBF injection happens on the written file before the command returns.

### 6. Settings Persistence
- `commands/settings.rs` persists preferences to `veramark-settings.json` in the app config dir (`C2paSettings`, format, JPEG quality). The frontend hydrates once on startup and **debounce-saves (400 ms)** on change; C2PA stays disabled by default.

---

## Directory Structure

```text
├── assets/
│   ├── app-icon.png
│   └── labels/                    # SVG/PNG AI-attribution badges (watched)
├── scripts/                       # dev/build/test/icon scripts (.cmd, .mjs)
├── src/                           # Frontend (React + TypeScript)
│   ├── components/
│   │   ├── canvas/                # PreviewCanvas, OverlayCanvas, BatchGallery
│   │   ├── catalog/               # LabelCatalog
│   │   ├── layout/                # AppHeader, AboutDialog
│   │   ├── sidebar/               # AssetPanel, InspectorPanel, TransformPanel,
│   │   │                          #   ProvenancePanel, ExportPanel
│   │   └── ui/                    # Button, Slider, Select, Toggle, Panel,
│   │                              #   Spinner, VeraMarkIcon
│   ├── constants/files.ts         # IMAGE_FILTERS
│   ├── hooks/useImageActions.ts   # open/export/batch orchestration
│   ├── models/                    # label.ts, c2pa.ts, image.ts (mirror Rust)
│   ├── services/                  # tauri.ts (IPC), c2pa.ts (manifest adapter)
│   ├── stores/useVeraMarkStore.ts # Zustand store
│   ├── utils/                     # transform.ts, paths.ts
│   ├── styles.css                 # @import "tailwindcss";
│   ├── main.tsx                   # React entry point
│   └── App.tsx                    # Root layout + event/settings wiring
├── src-tauri/                     # Rust Backend
│   ├── src/
│   │   ├── commands/              # labels, export, batch, provenance, settings
│   │   ├── engine/                # compositor, encoder, loader,
│   │   │                          #   c2pa_signer, batch_runner
│   │   ├── models.rs              # serde structs mirrored in TS
│   │   ├── lib.rs                 # Builder setup + invoke_handler
│   │   └── main.rs
│   ├── tests/                     # integration tests (pipeline.rs) + fixtures/
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
├── vite.config.ts                 # @vitejs/plugin-react + @tailwindcss/vite
└── tsconfig.json                  # strict
```

---

## Development Constraints & Rules for AI Agents

1. **Strict type safety:** no `any`. Every Tauri command argument/payload must have a matching Rust struct and TypeScript interface (`camelCase` rename_all on both sides).
2. **WYSIWYG parity:** any change to `utils/transform.ts` must be mirrored exactly in `engine/compositor.rs` (and vice-versa), including rounding semantics and offset direction.
3. **Never block the UI thread:** heavy composition/encoding/batch work must run off the main thread (`spawn_blocking` / rayon) and report progress via events.
4. **Zero in-memory leakage:** avoid repeated large-bitmap clones; buffer/stream writes (`BufWriter`, in-memory `Cursor`) and keep batch thumbnails LRU-bounded.
5. **C2PA compliance:** manifests must always be signed (PS256); never emit an unsigned claim; keep action/hash assertions spec-compliant. C2PA remains opt-in (disabled by default).
6. **Tailwind best practices:** abstract repeated utility classes into `components/ui/` primitives so main views stay declarative.

## Development Commands

- **Frontend:** `npm run dev` (Vite), `npm run build` (`tsc --noEmit && vite build`)
- **Desktop:** `npm run tauri dev`, `npm run tauri build`
- **Rust tests:** `scripts/run-tests.cmd` (runs `cargo test`, logs to `cargo-test.log`). Integration tests live in `src-tauri/tests/pipeline.rs` (fixtures under `src-tauri/tests/fixtures/`); unit tests sit alongside code (e.g. `commands/export.rs`).
- **Other scripts:** `scripts/build.cmd` (cargo build), `scripts/fetch-deps.cmd` (cargo fetch), `scripts/make-icon.mjs` (app icon generation).
