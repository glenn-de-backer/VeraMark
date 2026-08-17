use serde::{Deserialize, Serialize};
use std::path::PathBuf;
use tauri::{AppHandle, Manager};

use crate::models::{C2paSettings, ExportFormat};

/// Persisted user preferences (the "Settings JSON file"). C2PA embedding is
/// deliberately **off** by default — users opt in before signing images.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SettingsFile {
    pub c2pa: C2paSettings,
    pub format: ExportFormat,
    pub jpeg_quality: u8,
}

impl Default for SettingsFile {
    fn default() -> Self {
        SettingsFile {
            c2pa: C2paSettings {
                enabled: false,
                claim_generator_name: "VeraMark".to_string(),
                claim_generator_version: "0.1.0".to_string(),
                producer_trained_on_data: false,
                signer_key_path: String::new(),
                signer_cert_path: String::new(),
            },
            format: ExportFormat::Jpeg,
            jpeg_quality: 92,
        }
    }
}

fn settings_file_path(app: &AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_config_dir()
        .map_err(|err| format!("could not resolve app config dir: {err}"))?;
    std::fs::create_dir_all(&dir).map_err(|err| format!("could not create config dir: {err}"))?;
    Ok(dir.join("veramark-settings.json"))
}

/// Loads persisted preferences. Returns defaults (C2PA disabled) when the
/// settings file is missing or unreadable — never fails.
#[tauri::command]
pub fn load_settings(app: AppHandle) -> SettingsFile {
    let Ok(path) = settings_file_path(&app) else {
        return SettingsFile::default();
    };
    match std::fs::read_to_string(&path) {
        Ok(contents) => {
            serde_json::from_str(&contents).unwrap_or_else(|_| SettingsFile::default())
        }
        Err(_) => SettingsFile::default(),
    }
}

/// Persists preferences to the settings JSON file (pretty-printed).
#[tauri::command]
pub fn save_settings(app: AppHandle, settings: SettingsFile) -> Result<(), String> {
    let path = settings_file_path(&app)?;
    let contents =
        serde_json::to_string_pretty(&settings).map_err(|err| format!("serialize failed: {err}"))?;
    std::fs::write(&path, contents).map_err(|err| format!("write failed: {err}"))
}