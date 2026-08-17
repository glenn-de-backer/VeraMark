use std::path::Path;

use c2pa::validation_results::ValidationState;
use c2pa::{Context, Reader};
use serde::Serialize;

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ManifestReadResult {
    pub title: Option<String>,
    pub format: Option<String>,
    pub claim_generator: Option<String>,
    /// Some(true) when the claim signature cryptographically verifies and
    /// chains to a known C2PA trust anchor; Some(false) when it is genuinely
    /// broken; None when it cannot be classified (e.g. a self-signed /
    /// untrusted test credential).
    pub signature_valid: Option<bool>,
    pub labels: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SignerStatusResult {
    /// `false` when either path is empty — nothing to validate.
    pub configured: bool,
    /// `true` when C2PA can load the key + certificate into a signer context.
    pub valid: bool,
    pub error: Option<String>,
}

/// Validates a PEM signing key + certificate pair by loading it into the same
/// C2PA signer settings the exporter uses. Lightweight — no image I/O, so it
/// can run every time the user picks a path in the Provenance panel.
#[tauri::command]
pub fn validate_signer(key_path: String, cert_path: String) -> SignerStatusResult {
    if key_path.trim().is_empty() || cert_path.trim().is_empty() {
        return SignerStatusResult {
            configured: false,
            valid: false,
            error: None,
        };
    }
    match crate::engine::c2pa_signer::validate_signer_files(&key_path, &cert_path) {
        Ok(()) => SignerStatusResult {
            configured: true,
            valid: true,
            error: None,
        },
        Err(err) => SignerStatusResult {
            configured: true,
            valid: false,
            error: Some(err.to_string()),
        },
    }
}

/// Reads the C2PA manifest store from an image and summarizes the active
/// manifest for the UI. Returns `None` when no manifest is present.
#[tauri::command]
pub fn read_manifest(path: String) -> Result<Option<ManifestReadResult>, String> {
    let path = Path::new(&path);
    let reader = match Reader::from_context(Context::new()).with_file(path) {
        Ok(reader) => reader,
        Err(err) => {
            log::debug!("read_manifest: no manifest for {} ({err})", path.display());
            return Ok(None);
        }
    };

    let Some(manifest) = reader.active_manifest() else {
        return Ok(None);
    };

    let signature_valid = match reader.validation_state() {
        ValidationState::Valid | ValidationState::Trusted => Some(true),
        // Without a trust anchor c2pa reports the signing credential as
        // untrusted -> the state is Invalid. We cannot distinguish an
        // untrusted-but-correct signature from a broken one here, so report
        // "unknown" rather than a false negative.
        ValidationState::Invalid => None,
    };

    let labels = reader
        .iter_manifests()
        .filter_map(|manifest| manifest.label().map(|label| label.to_string()))
        .collect();

    Ok(Some(ManifestReadResult {
        title: manifest.title().map(|title| title.to_string()),
        format: manifest.format().map(|format| format.to_string()),
        claim_generator: manifest.claim_generator().map(|ua| ua.to_string()),
        signature_valid,
        labels,
    }))
}