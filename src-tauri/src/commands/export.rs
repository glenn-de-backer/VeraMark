use std::path::{Path, PathBuf};

use base64::Engine as _;
use image::{ExtendedColorType, GenericImageView, ImageEncoder};
use serde::{Deserialize, Serialize};

use crate::engine::{compositor, encoder, loader};
use crate::models::{C2paSettings, ExportFormat, TransformConfig};

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewRequest {
    pub path: String,
    pub max_dim: u32,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PreviewImage {
    pub data_url: String,
    pub width: u32,
    pub height: u32,
    pub original_width: u32,
    pub original_height: u32,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProcessAndExportRequest {
    pub input_path: String,
    pub output_path: String,
    pub label_id: String,
    pub transform: TransformConfig,
    pub format: ExportFormat,
    pub jpeg_quality: u8,
    pub c2pa: C2paSettings,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ExportResult {
    pub output_path: String,
    pub format: String,
    pub width: u32,
    pub height: u32,
    pub bytes_written: u64,
    pub manifest_label: Option<String>,
    pub manifest_signed: bool,
}

/// Loads a label asset (by file name) from the configured labels directory,
/// returning owned bytes + detected kind. Empty `label_id` means "no overlay".
pub fn load_label_owned(
    label_id: &str,
) -> Result<Option<(Vec<u8>, compositor::LabelKind)>, String> {
    if label_id.trim().is_empty() {
        return Ok(None);
    }
    let dir = loader::resolve_labels_dir().map_err(|err| err.to_string())?;
    let path = dir.join(label_id);
    let bytes = std::fs::read(&path).map_err(|err| {
        format!("label {} not found in {}: {err}", label_id, dir.display())
    })?;
    let ext = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    let kind = if ext == "svg" {
        compositor::LabelKind::Svg
    } else {
        compositor::LabelKind::Png
    };
    Ok(Some((bytes, kind)))
}

#[tauri::command]
pub async fn preview_image(request: PreviewRequest) -> Result<PreviewImage, String> {
    tauri::async_runtime::spawn_blocking(move || {
        render_preview(&PathBuf::from(&request.path), request.max_dim)
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(|err| err.to_string())
}

fn render_preview(path: &Path, max_dim: u32) -> Result<PreviewImage, String> {
    let img = image::open(path).map_err(|err| format!("decode failed: {err}"))?;
    let (original_width, original_height) = img.dimensions();
    let max_dim = max_dim.max(64);
    let (width, height) = if original_width > max_dim || original_height > max_dim {
        let scale = max_dim as f32 / original_width.max(original_height) as f32;
        (
            ((original_width as f32 * scale).round() as u32).max(1),
            ((original_height as f32 * scale).round() as u32).max(1),
        )
    } else {
        (original_width, original_height)
    };

    let resized = if width == original_width && height == original_height {
        img
    } else {
        img.thumbnail(width, height)
    };
    let has_alpha = resized.color().has_alpha();

    let mut bytes: Vec<u8> = Vec::new();
    let mime;
    if has_alpha {
        mime = "image/png";
        let rgba8 = resized.to_rgba8();
        image::codecs::png::PngEncoder::new(&mut bytes)
            .write_image(
                rgba8.as_raw(),
                width,
                height,
                ExtendedColorType::Rgba8,
            )
            .map_err(|err| err.to_string())?;
    } else {
        mime = "image/jpeg";
        let rgb = resized.to_rgb8();
        let encoder =
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut bytes, 85);
        encoder
            .write_image(&rgb, width, height, ExtendedColorType::Rgb8)
            .map_err(|err| err.to_string())?;
    }

    let data_url = format!(
        "data:{mime};base64,{}",
        base64::engine::general_purpose::STANDARD.encode(&bytes)
    );
    Ok(PreviewImage {
        data_url,
        width,
        height,
        original_width,
        original_height,
    })
}

#[tauri::command]
pub async fn process_and_export(request: ProcessAndExportRequest) -> Result<ExportResult, String> {
    tauri::async_runtime::spawn_blocking(move || {
        let label = load_label_owned(&request.label_id)?;
        let output_path = Path::new(&request.output_path).to_path_buf();
        let input_path = Path::new(&request.input_path).to_path_buf();
        process_one_file(
            &input_path,
            &output_path,
            &label,
            &request.transform,
            request.format,
            request.jpeg_quality,
            &request.c2pa,
        )
    })
    .await
    .map_err(|err| err.to_string())?
    .map_err(|err| err.to_string())
}

/// Shared single-file pipeline used by both single-image export and the
/// parallel batch runner:
///   compose → encode → (optional) inject C2PA manifest.
pub fn process_one_file(
    input_path: &Path,
    output_path: &Path,
    label: &Option<(Vec<u8>, compositor::LabelKind)>,
    transform: &TransformConfig,
    format: ExportFormat,
    jpeg_quality: u8,
    c2pa: &C2paSettings,
) -> Result<ExportResult, String> {
    if format == ExportFormat::Jpeg && !(1..=100).contains(&jpeg_quality) {
        return Err("JPEG quality must be between 1 and 100".to_string());
    }
    if c2pa.enabled
        && (c2pa.signer_key_path.trim().is_empty() || c2pa.signer_cert_path.trim().is_empty())
    {
        return Err(
            "C2PA is enabled but no signing key/certificate is configured".to_string(),
        );
    }

    let label_source = label.as_ref().map(|(bytes, kind)| compositor::LabelSource {
        bytes: bytes.as_slice(),
        kind: *kind,
    });

    let composed = compositor::compose(compositor::ComposeInput {
        source_path: input_path,
        label: label_source,
        transform,
    })
    .map_err(|err| err.to_string())?;

    let width = composed.width;
    let height = composed.height;
    let bytes_written = encoder::encode_and_write(
        &composed,
        format,
        jpeg_quality,
        output_path,
    )
    .map_err(|err| err.to_string())?;

    let (manifest_label, manifest_signed) = if c2pa.enabled {
        crate::engine::c2pa_signer::embed_manifest(output_path, c2pa, format.mime())
            .map_err(|err| err.to_string())?
    } else {
        (None, false)
    };

    Ok(ExportResult {
        output_path: output_path.display().to_string(),
        format: format.extension().to_string(),
        width,
        height,
        bytes_written,
        manifest_label,
        manifest_signed,
    })
}