# VeraMark

**VeraMark** is a high-performance desktop application designed to label, certify, and embed provenance data into AI-generated or edited imagery. It simultaneously applies visible on-canvas badges and embeds cryptographic [C2PA](https://c2pa.org/) / Content Authenticity Initiative (CAI) metadata directly into exported image files.

---

## Key Highlights

- **Dual Attribution:** Combines visible human-readable badges with invisible, machine-readable C2PA manifests.
- **EU AI Act Article 50 Ready:** Meets transparency and machine-readability compliance mandates.
- **High-Performance Architecture:** Built with Tauri v2, a Rust backend, Rayon-parallel batch processing, and a Vite + React + TypeScript frontend.
- **WYSIWYG Fidelity:** Identical transform math between frontend canvas preview and Rust compositor.

---

## Core Features

- **Single & Batch Processing:** Process individual files with fine-grained anchor/scale controls or run parallelized folder conversions with live progress updates.
- **C2PA Provenance Manifests:** Generates `c2pa.created` and `c2pa.edited` action assertions, claim generator data, trained-source flags, and cryptographic `ps256` signatures via the `c2pa-rs` Builder API.
- **Format Support:** High-fidelity PNG (8/16-bit, alpha preservation, best-effort ICC) and configurable JPEG output.
- **Live Directory Watching:** Automatically registers new overlay assets dropped into the labels directory.

---

## EU AI Act Article 50 Compliance & Icon Catalog

**Article 50** of the EU AI Act mandates that providers of AI systems generating synthetic audio, image, video, or text ensure outputs are marked in a machine-readable format and detectable as artificially generated or manipulated.

### Official EU Icons

VeraMark includes the official European Commission visual labelling assets:
- **Source:** [EU Icons for Labelling AI-Generated Content](https://digital-strategy.ec.europa.eu/en/policies/eu-icons-labelling-ai-generated-content)
- **Custom Labels:** Add any custom `.svg` or `.png` to `assets/labels/` (or override via `VERAMARK_LABELS_DIR`). Assets are automatically scaled relative to `min(imageWidth, imageHeight)`.

### Compliance Mapping

| Requirement | Implementation in VeraMark |
| :--- | :--- |
| **Machine-Readable Mark** | Cryptographically bound C2PA manifest (`c2pa.created` / action assertions). |
| **Human-Visible Disclosure** | Standardized visual badges, including the official EU AI Act icons. |
| **Tamper Evidence** | Cryptographic hash binding invalidates verification if pixel data is stripped or edited. |
| **Interoperability** | Open C2PA standard readable by standard verifiers and `contentcredentials.org/verify`. |

---

## C2PA Signing Workflows

VeraMark guarantees that every exported claim is signed.

| Feature | Development / Self-Hosted | Certified Public Trust |
| :--- | :--- | :--- |
| **Credential Type** | Self-signed CA / OpenSSL / step-ca | Trust-listed public CA or Cloud Signer |
| **Cost** | **$0** | Varies by provider |
| **Third-Party Verification** | Marks signature as "unverified/untrusted" unless root is imported | Automatically displays as **Trusted** |
| **Target Use Case** | Local QA, automated testing, closed ecosystems | Public distribution, commercial publishing |

### Setting Up a Free Test Chain (OpenSSL)

```bash
# 1. Root CA
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out ca_key.pem
openssl req -new -key ca_key.pem -out ca.csr -subj "/CN=VeraMark Test CA/O=VeraMark"
openssl x509 -req -in ca.csr -signkey ca_key.pem -out ca_cert.pem -days 3650 \
  -extfile <(printf 'basicConstraints=critical,CA:TRUE\nkeyUsage=critical,keyCertSign,cRLSign\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid\n')

# 2. Leaf Signer (PS256 / RSA-PSS)
openssl genpkey -algorithm RSA -pkeyopt rsa_keygen_bits:2048 -out leaf_key.pem
openssl req -new -key leaf_key.pem -out leaf.csr -subj "/CN=VeraMark Signer/O=VeraMark"
openssl x509 -req -in leaf.csr -CA ca_cert.pem -CAkey ca_key.pem -CAcreateserial \
  -out leaf_cert.pem -days 365 -extfile <(printf 'basicConstraints=critical,CA:FALSE\nkeyUsage=critical,digitalSignature,nonRepudiation\nextendedKeyUsage=1.3.6.1.5.5.7.3.36\nsubjectKeyIdentifier=hash\nauthorityKeyIdentifier=keyid,issuer\n')

# 3. Assemble Chain
cat leaf_cert.pem ca_cert.pem > signer_chain.pem
```

> Supply `leaf_key.pem` and `signer_chain.pem` in the **Provenance (C2PA)** panel.

---

## Architecture

```text
src/                         Frontend (React + TypeScript + Tailwind CSS v4)
  components/
    layout/                  SplitPane layout
    sidebar/                 Source, Transform, Export, and Provenance panels
    canvas/                  WYSIWYG overlay preview and gallery
    catalog/                 EU & custom badge selector
  models/                    Type definitions (mirrored in Rust)
  services/tauri.ts          Typed IPC bridge
  stores/                    Zustand application state
  utils/transform.ts         Overlay transform math (mirrored in compositor.rs)

src-tauri/                   Backend (Rust + Tauri v2)
  src/
    commands/                IPC command handlers (export, batch, labels, C2PA)
    engine/
      compositor.rs          Pixel transforms and alpha-blending
      encoder.rs             PNG (ICC) and JPEG encoders
      c2pa_signer.rs         Manifest definition and PS256 signing pipeline
      batch_runner.rs        Rayon parallel worker pool
      loader.rs              Label directory resolution and filesystem watcher
```

---

## Getting Started

### Prerequisites

- **OS:** Windows 10/11 (with WebView2) / macOS / Linux
- **Rust:** Stable MSVC / GCC toolchain
- **Node.js:** Node 20+ (Node 24 tested)
- **Build Tools:** Visual Studio 2022 C++ Build Tools (Windows MSVC Linker) or equivalent C toolchain

### Installation & Development

```bash
# Install frontend dependencies
npm install

# Run application in development mode
npm run tauri dev
```

### Verification & Testing

```bash
# Type check and build frontend
npm run build

# Run Rust integration tests (compositor, encoders, C2PA sign/verify loop)
cd src-tauri
cargo test
```

---

## Known Limitations

- **JPEG Metadata:** Full ICC/EXIF pass-through is currently prioritized for PNG workflows; JPEG metadata retention is in development.
- **Remote Signers:** Remote/cloud signing endpoints and RFC 3161 TSA URLs are supported by the underlying `c2pa-rs` library, with UI controls planned for a future release.
- **Assertion Granularity:** `c2pa.training-mining` assertions are planned; training state currently maps to the `digitalSourceType` action.
