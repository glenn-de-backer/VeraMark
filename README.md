# VeraMark

Overlay configurable **AI attribution labels** and embed cryptographically
signed **C2PA / CAI provenance manifests** into images.

A high-performance desktop application built with **Tauri v2** (Rust backend)
and a **Vite + React + TypeScript + Tailwind CSS v4** frontend on a strict
split-pane layout: left settings, right live WYSIWYG preview.

## Features

- **Single-image mode** — open a photo, adjust anchor / scale / offsets, and
  export.
- **Batch directory mode** — Rayon-parallel processing of every image in a
  folder with live progress events.
- **Live preview** — the canvas applies the exact same transform math as the
  Rust compositor (`src/utils/transform.ts` ⇄
  `src-tauri/src/engine/compositor.rs`), so preview == export.
- **C2PA / CAI signing** — `c2pa.created` / `c2pa.edited` action assertions,
  claim generator info, trained-source declarations, and a cryptographic
  `ps256` signature injected via the c2pa-rs `Builder` API.
- **Export formats** — PNG (8/16-bit, alpha, best-effort ICC) and JPEG
  (quality 1–100, alpha flattened onto white).
- **Runtime label watching** — SVGs/PNGs dropped into the labels directory
  appear automatically.

## Requirements

- Windows 10/11 with WebView2 (bundled with Windows 11)
- [Rust](https://rustup.rs) MSVC toolchain (stable)
- [Node.js](https://nodejs.org) 20+ (project was validated with Node 24)
- Visual Studio 2022 Build Tools (MSVC linker)

## Getting started

```bash
npm install
```

Run the desktop app in development:

```bash
npm run tauri dev
```

Validate the frontend (strict TS + Vite build):

```bash
npm run build
```

Run the Rust integration tests (compositor geometry, PNG/JPEG pipeline, and a
full C2PA sign → verify round-trip):

```bash
cd src-tauri
cargo test
```

## Labels

Badges live in `assets/labels/` (override with the `VERAMARK_LABELS_DIR`
environment variable). Supported formats: `.svg` and `.png`. Any dimensions
work; the overlay scales them relative to the `min(imageWidth, imageHeight)`.
Sample duplicates are included in `assets/labels/`.

## C2PA signing keys and certificates

The signer requires a **PKCS#8** private key and a **PEM certificate chain**
whose leaf certificate:

- is issued by a CA (self-signed end-entity certificates are rejected)
- contains an **Organization (`O=`)** in the Subject — the C2PA verifier uses
  it to label the claim author
- carries the `documentSigning` EKU (`1.3.6.1.5.5.7.3.36`) or a C2PA signing
  EKU
- has `KeyUsage=digitalSignature`

Generate a compatible test chain with OpenSSL:

```bash
# CA
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out ca_key.pem
openssl req -new -key ca_key.pem -out ca.csr -subj "/CN=VeraMark Test CA/O=VeraMark"
openssl x509 -req -in ca.csr -signkey ca_key.pem -out ca_cert.pem -days 3650 \
  -extfile <(printf 'basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid\n')

# Signer leaf (PS256 / RSA-PSS)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out leaf_key.pem
openssl req -new -key leaf_key.pem -out leaf.csr -subj "/CN=VeraMark Signer/O=VeraMark"
openssl x509 -req -in leaf.csr -CA ca_cert.pem -CAkey ca_key.pem -CAcreateserial \
  -out leaf_cert.pem -days 365 -extfile <(printf 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,nonRepudiation\nextendedKeyUsage=1.3.6.1.5.5.7.3.36\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\n')

# chain = leaf + CA
cat leaf_cert.pem ca_cert.pem > signer_chain.pem
```

Point the **Provenance (C2PA)** panel at `leaf_key.pem` and `signer_chain.pem`.

> VeraMark never exports an unsigned claim — if C2PA is enabled without a
> valid key/certificate pair, export fails with a clear message.

## Architecture

```text
src/                     Frontend (React + TS strict + Tailwind v4)
  components/
    layout/              SplitPane
    sidebar/             Source / Transform / Export / Provenance panels
    canvas/              Live overlay preview + gallery
    catalog/             Label selector
  models/                label.ts, image.ts, c2pa.ts  (mirrored in Rust)
  services/tauri.ts      Strictly-typed IPC bridge
  stores/                zustand store
  utils/transform.ts     OverlayTransformBuilder (mirrored in Rust)

src-tauri/
  src/
    commands/            Tauri IPC commands (labels, export, batch, provenance)
    engine/
      compositor.rs      Load → label geometry → alpha-composite
      encoder.rs         PNG (8/16-bit + ICC) and JPEG (quality) writers
      c2pa_signer.rs     ManifestDefinition + ps256 signing (Builder API)
      batch_runner.rs    Rayon-parallel batch with progress events
      loader.rs          Label directory resolution + notify watcher
```

## Known limitations (v0.1)

- JPEG output re-encodes via Rust; ICC/EXIF retention is currently exercised
  for PNG (ICC) only — JPEG metadata pass-through is a future enhancement.
- Signature trust requires the signer's root CA in the C2PA trust list;
  without a trust anchor c2pa-rs reports the credential as untrusted.
- `c2pa.training-mining` assertions are not yet emitted (the UI training flag
  currently drives the action `digitalSourceType`).

## Scripts

| Script                    | Purpose                                   |
| ------------------------- | ----------------------------------------- |
| `npm run dev`             | Vite dev server (used by `tauri dev`)     |
| `npm run build`           | `tsc --noEmit` + production Vite build    |
| `npm run tauri dev`       | Launch the desktop app in dev mode        |
| `npm run tauri build`     | Build a release bundle                    |
| `cargo test` (`src-tauri`)| Rust integration tests                    |