use std::path::Path;

use base64::Engine as _;
use serde::Serialize;
use tauri::{AppHandle, Manager};

use crate::engine::loader::{self, LabelWatcherState};

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LabelEntry {
    pub id: String,
    pub name: String,
    pub kind: String,
    pub data_url: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct LoadLabelsResult {
    pub labels: Vec<LabelEntry>,
    pub directory: String,
    pub errors: Vec<String>,
}

fn encode_label(path: &Path) -> Result<LabelEntry, String> {
    let bytes = std::fs::read(path).map_err(|err| err.to_string())?;
    let id = path
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("")
        .to_string();
    let name = path
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("")
        .to_string();
    let ext = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();

    let (kind, mime) = if ext == "svg" {
        ("svg".to_string(), "image/svg+xml".to_string())
    } else {
        ("png".to_string(), "image/png".to_string())
    };

    let data_url = format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(&bytes)
    );

    Ok(LabelEntry {
        id,
        name,
        kind,
        data_url,
    })
}

fn load_label_files(dir: &Path) -> LoadLabelsResult {
    let mut labels = Vec::new();
    let mut errors = Vec::new();
    for file in loader::scan_label_files(dir) {
        match encode_label(&file) {
            Ok(entry) => labels.push(entry),
            Err(err) => errors.push(format!("{}: {err}", file.display())),
        }
    }
    LoadLabelsResult {
        labels,
        directory: dir.display().to_string(),
        errors,
    }
}

#[tauri::command]
pub fn load_labels() -> Result<LoadLabelsResult, String> {
    let dir = loader::resolve_labels_dir().map_err(|err| err.to_string())?;
    Ok(load_label_files(&dir))
}

#[tauri::command]
pub fn refresh_labels() -> Result<LoadLabelsResult, String> {
    load_labels()
}

#[tauri::command]
pub fn watch_labels(app: AppHandle) -> Result<(), String> {
    if app.try_state::<LabelWatcherState>().is_some() {
        return Ok(());
    }
    loader::setup_label_watcher(&app)
}