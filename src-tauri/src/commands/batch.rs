use serde::{Deserialize, Serialize};

use image::GenericImageView;

use crate::models::{C2paSettings, ExportFormat, TransformConfig};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchRequest {
    pub input_dir: String,
    pub output_dir: String,
    /// Exact image paths to process; empty means "process the whole directory".
    pub files: Vec<String>,
    pub label_id: String,
    pub transform: TransformConfig,
    pub format: ExportFormat,
    pub jpeg_quality: u8,
    pub c2pa: C2paSettings,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchProgressPayload {
    pub done: usize,
    pub total: usize,
    pub current: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BatchResult {
    pub processed: usize,
    pub failed: usize,
    pub outputs: Vec<String>,
    pub errors: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ImageFileInfo {
    pub path: String,
    pub name: String,
    pub width: u32,
    pub height: u32,
}

#[tauri::command]
pub async fn list_batch_images(input_dir: String) -> Result<Vec<ImageFileInfo>, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let dir = std::path::PathBuf::from(&input_dir);
        let mut files = Vec::new();
        for entry in std::fs::read_dir(&dir).map_err(|err| err.to_string())?.flatten() {
            let path = entry.path();
            if !path.is_file() || !has_supported_image_extension(&path) {
                continue;
            }
            let name = path
                .file_name()
                .and_then(|name| name.to_str())
                .unwrap_or("")
                .to_string();
            if let Ok(img) = image::open(&path) {
                let (width, height) = img.dimensions();
                files.push(ImageFileInfo {
                    path: path.display().to_string(),
                    name,
                    width,
                    height,
                });
            }
        }
        files.sort_by(|a, b| a.name.cmp(&b.name));
        Ok(files)
    })
    .await
    .map_err(|err: tauri::Error| err.to_string())?
    .map_err(|err: String| err)
}

#[tauri::command]
pub async fn process_batch_directory(
    app: tauri::AppHandle,
    request: BatchRequest,
) -> Result<BatchResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        crate::engine::batch_runner::run_batch(&app, request)
    })
    .await
    .map_err(|err: tauri::Error| err.to_string())?
    .map_err(|err: String| err)
}

pub fn has_supported_image_extension(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|ext| ext.to_str())
        .is_some_and(|ext| {
            matches!(
                ext.to_ascii_lowercase().as_str(),
                "png" | "jpg" | "jpeg" | "webp" | "bmp" | "tiff" | "gif"
            )
        })
}