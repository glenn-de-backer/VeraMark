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