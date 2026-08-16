# AGENTS.md

## Project Overview
A high-performance desktop application called VeraMark built with **Tauri v2**, **Vite**, **TypeScript**, and **Tailwind CSS v4** for overlaying configurable AI attribution labels and embedding cryptographically secure **C2PA / CAI** (Coalition for Content Provenance and Authenticity) manifest watermarks into images. 

The application supports both single-image granular editing and bulk directory processing, with a split-pane interface prioritizing real-time visual feedback.

---

## Core Architecture & Tech Stack

```text
┌────────────────────────────────────────────────────────┐
│               Frontend (TypeScript + Vite)             │
│  - Presentation Layer (Split UI: Left Settings,        │
│    Right Live Canvas Preview)                          │
│  - Styling Engine (Tailwind CSS v4 + Vite Plugin)      │
│  - State Management & Command Dispatchers              │
│  - Pipeline Orchestration (Strategy / Builder Patterns)│
└───────────────────────────┬────────────────────────────┘
                            │ Tauri IPC (invoke / events)
┌───────────────────────────▼────────────────────────────┐
│                    Rust Backend (Core)                 │
│  - Image Compositor (image-rs)                         │
│  - Directory & Asset Watcher                           │
│  - C2PA Manifest Engine (c2pa-rs)                      │
│  - Parallel Batch Exporter (Rayon)                     │
└────────────────────────────────────────────────────────┘
```

- **Runtime & Shell:** Tauri v2 (Rust backend + Webview frontend)
- **Frontend Core:** Vite + TypeScript (Strict Mode) + Tailwind CSS v4
- **Image Compositing:** Hybrid (Offscreen Canvas / WebGPU for instant preview; Rust `image` crate for high-fidelity export)
- **Provenance & Watermarking:** Rust `c2pa` crate integration for signing manifests and injection

---

## User Interface (UI/UX) Layout

The frontend must adhere to a strict split-pane layout designed with Tailwind utility classes:
* **Left Sidebar (Controls & Settings):** 
  * Label Catalog (Select from available AI badges).
  * Property Controls (Scale, Position/Anchor, X/Y Offset).
  * Processing Mode Toggle (Single File vs. Batch Directory).
  * Export & C2PA Metadata settings.
* **Main/Right Viewport (Image Preview):** 
  * Interactive canvas displaying the currently selected image.
  * Real-time visual feedback of label positioning and scaling.
  * In Batch Mode, this acts as a gallery/carousel preview of the first few images in the directory.

---

## Design Patterns & Standards

### Frontend Patterns
* **Strategy Pattern:** `ExportFormatStrategy` handles encoding logic (`image/png` vs `image/jpeg` compression and metadata preservation).
* **Builder Pattern:** `OverlayTransformBuilder` constructs label positioning, scale, and offset transformations before application.
* **Observer / Store Pattern:** Centralized reactive state for active image selection, active directory path, label catalog, and positioning presets.
* **Adapter Pattern:** `C2paManifestAdapter` bridges frontend user-entered provenance metadata into backend-compliant C2PA claim definitions.
* **Component Abstraction:** Heavy extraction of Tailwind utility classes into reusable UI components (e.g., `<Button>`, `<Slider>`, `<Panel>`) to prevent HTML bloat in main views.

### Backend (Rust) Patterns
* **Command Pattern:** Isolated Tauri commands (`load_labels`, `process_overlay`, `sign_and_export`, `process_batch_directory`) for clear boundary enforcement.
* **Pipeline / Chain of Responsibility:** Linear processing pipeline:
  `Load Source(s)` -> `Apply Label Geometry` -> `Rasterize / Encode` -> `Inject C2PA Manifest` -> `Write to Disk`.

---

## Technical Specifications & Features

### 1. Label Asset Management
- **Directory Watching:** Reads a dedicated label directory (`assets/labels/` or user-configured folder) containing SVG/PNG badge assets.
- **Dynamic Catalog:** Automatically registers new assets added to the target folder at runtime.

### 2. Label Positioning & Transform Matrix
Each label configuration must support:
- **Base Anchor (Cardinal Positioning):** `Top-Left`, `Top-Center`, `Top-Right`, `Center`, `Bottom-Left`, `Bottom-Center`, `Bottom-Right`.
- **Scale:** Normalized relative scale (0.01 to 1.0 relative to image bounding box) or absolute pixel dimensions.
- **Offset Coordinates:** (X, Y) offset in absolute pixels or percentages from the selected anchor.

### 3. Processing Modes
- **Single Image Mode:** Load a single file, adjust settings with live preview, and export.
- **Batch Directory Mode:** 
  - User selects an input directory and an output directory via native file dialogs.
  - The UI locks the global transform settings (scale, anchor, offset).
  - The Rust backend processes all valid images in the directory concurrently using `rayon`.

### 4. C2PA / CAI Watermarking & Provenance
- Integration with the Rust `c2pa` library.
- Generates compliant assertion manifests containing generative AI metadata and action assertions (`c2pa.edited`, `c2pa.created`).

### 5. Image Export Engine
- High-throughput parallel batch processing via Rust (`rayon` threads).
- Format options: PNG (Lossless, RGBA8/RGBA16) and JPEG (Quality 1-100, chroma subsampling).
- Embedded metadata retention (EXIF, ICC profiles) alongside C2PA JUMBF chunks.

---

## Directory Structure

```text
├── src/                          # Frontend Application
│   ├── assets/                   # Static application UI assets
│   ├── components/               # Atomic UI components
│   │   ├── layout/               # Split-pane layout wrappers
│   │   ├── canvas/               # Viewport & live preview (Right panel)
│   │   ├── sidebar/              # Settings & controls (Left panel)
│   │   └── catalog/              # Label selector drawer
│   ├── models/                   # TypeScript interfaces & types
│   │   ├── c2pa.ts
│   │   ├── image.ts
│   │   └── label.ts
│   ├── services/                 # Tauri IPC bridges and native hooks
│   ├── stores/                   # State stores (zustand/pinia/etc.)
│   ├── utils/                    # Math & transform calculation helpers
│   ├── styles.css                # Tailwind CSS v4 entry point (@import "tailwindcss";)
│   ├── main.ts                   # Main TS entry point
│   └── App.tsx                   # Main React/Solid/Vue layout component
├── src-tauri/                    # Rust Backend Core
│   ├── src/
│   │   ├── commands/             # Tauri IPC entry points
│   │   │   ├── batch.rs          # Directory selection & batch processing IPC
│   │   │   ├── export.rs
│   │   │   ├── labels.rs
│   │   │   └── provenance.rs
│   │   ├── engine/               # Processing engines
│   │   │   ├── c2pa_signer.rs    # C2PA manifest construction & signing
│   │   │   ├── compositor.rs     # Image blit & transform calculations
│   │   │   ├── batch_runner.rs   # Rayon parallel processing logic
│   │   │   └── loader.rs         # Directory watchers and file I/O
│   │   └── main.rs
│   ├── Cargo.toml
│   └── tauri.conf.json
├── package.json
└── vite.config.ts                # Includes @tailwindcss/vite plugin
```

---

## Development Constraints & Rules for AI Agents

1. **Strict Type Safety:** No use of `any` in TypeScript. All Tauri command arguments and payloads must have matching Rust structs and TypeScript interfaces.
2. **Zero In-Memory Leakage:** Large raw bitmaps must not be repeatedly cloned in memory. Use stream buffers or pass references within the Rust processing pipeline.
3. **Responsive Viewport:** Heavy image composition for final exports or batch directory processing must run asynchronously in Rust background worker threads, never blocking the main UI thread. Progress events should be emitted back to the UI.
4. **C2PA Compliance:** Manifest generation must strictly adhere to the C2PA specification standard without skipping hash assertions.
5. **Tailwind Best Practices:** Abstract repetitive utility classes into reusable framework components to keep UI views declarative and clean.
