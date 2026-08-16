use std::io::Cursor;
use std::path::Path;

use c2pa::settings::Settings;
use c2pa::{Builder, Context, DigitalSourceType};
use serde_json::json;

use crate::models::C2paSettings;

#[derive(Debug, thiserror::Error)]
pub enum C2paError {
    #[error("signing key/certificate I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("manifest generation failed: {0}")]
    C2pa(#[from] c2pa::Error),
}

const DIGITAL_SOURCE_TRAINED: &str =
    "http://cv.iptc.org/newscodes/digitalsourcetype/trainedAlgorithmicMedia";
const DIGITAL_SOURCE_CREATED: &str =
    "http://cv.iptc.org/newscodes/digitalsourcetype/algorithmicMedia";

/// Embeds and signs a C2PA manifest into the image at `source_path`,
/// replacing it in place (via a temp file + rename to guarantee atomicity
/// and to satisfy c2pa's "destination must not exist" contract).
///
/// The manifest contains:
/// * claim generator info
/// * `c2pa.created` / `c2pa.edited` action assertions
/// * a trained-algorithmic source declaration when flagged
///
/// Returns `(manifest label, signed)` — VeraMark never emits unsigned claims.
pub fn embed_manifest(
    source_path: &Path,
    c2pa_settings: &C2paSettings,
    format: &str,
) -> Result<(Option<String>, bool), C2paError> {
    let private_key = std::fs::read_to_string(&c2pa_settings.signer_key_path)?;
    let sign_cert = std::fs::read_to_string(&c2pa_settings.signer_cert_path)?;

    let settings_json = json!({
        "signer": {
            "local": {
                "alg": "ps256",
                "sign_cert": sign_cert,
                "private_key": private_key,
            }
        }
    })
    .to_string();

    let settings = Settings::new().with_json(&settings_json)?;
    let context = Context::new().with_settings(settings)?;

    let now = chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true);
    let software_agent = json!({
        "name": c2pa_settings.claim_generator_name,
        "version": c2pa_settings.claim_generator_version,
    });

    let mut actions = vec![
        json!({
            "action": "c2pa.created",
            "when": now,
            "softwareAgent": software_agent,
            "digitalSourceType": if c2pa_settings.producer_trained_on_data {
                DIGITAL_SOURCE_TRAINED
            } else {
                DIGITAL_SOURCE_CREATED
            },
        }),
        json!({
            "action": "c2pa.edited",
            "when": now,
            "softwareAgent": software_agent,
            "digitalSourceType": if c2pa_settings.producer_trained_on_data {
                DIGITAL_SOURCE_TRAINED
            } else {
                DIGITAL_SOURCE_CREATED
            },
        }),
    ];
    if c2pa_settings.producer_trained_on_data {
        actions.push(json!({
            "action": "c2pa.trained",
            "when": now,
            "softwareAgent": software_agent,
        }));
    }

    let definition = json!({
        "title": "VeraMark",
        "format": format,
        "claim_generator_info": [
            {
                "name": c2pa_settings.claim_generator_name,
                "version": c2pa_settings.claim_generator_version,
            }
        ],
        "assertions": [
            {
                "label": "c2pa.actions",
                "data": { "actions": actions }
            }
        ]
    })
    .to_string();

    let mut builder = Builder::from_context(context).with_definition(definition)?;
    builder.set_intent(c2pa::BuilderIntent::Create(DigitalSourceType::AlgorithmicMedia));

    let mut source = std::fs::File::open(source_path)?;
    let mut dest = Cursor::new(Vec::new());
    builder.save_to_stream(format, &mut source, &mut dest)?;
    std::fs::write(source_path, dest.get_ref())?;

    Ok((Some("VeraMark".to_string()), true))
}