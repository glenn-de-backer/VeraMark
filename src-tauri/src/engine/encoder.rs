use std::fs::File;
use std::io::BufWriter;
use std::path::Path;

use image::{ExtendedColorType, ImageEncoder as _, RgbaImage};

use crate::engine::compositor::Composited;
use crate::models::ExportFormat;

#[derive(Debug, thiserror::Error)]
pub enum EncodeError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("image encode error: {0}")]
    Image(#[from] image::ImageError),
    #[error("no pixel data was produced by composition")]
    Empty,
}

/// Encodes the composed buffer to `output_path` and returns bytes written.
///
/// * PNG keeps the source depth (8 or 16 bit), alpha, and best-effort ICC.
/// * JPEG flattens onto white and encodes at quality 1..=100.
pub fn encode_and_write(
    composed: &Composited,
    format: ExportFormat,
    jpeg_quality: u8,
    output_path: &Path,
) -> Result<u64, EncodeError> {
    match format {
        ExportFormat::Png => encode_png(composed, output_path),
        ExportFormat::Jpeg => encode_jpeg(composed, jpeg_quality, output_path),
    }
}

fn encode_png(composed: &Composited, output_path: &Path) -> Result<u64, EncodeError> {
    let file = File::create(output_path)?;
    let writer = BufWriter::new(file);

    let mut encoder = image::codecs::png::PngEncoder::new(writer);
    if let Some(icc) = &composed.icc {
        encoder
            .set_icc_profile(icc.clone())
            .map_err(image::ImageError::Unsupported)?;
    }

    if let Some(rgba16) = &composed.rgba16 {
        let mut raw: Vec<u8> = Vec::with_capacity(rgba16.as_raw().len() * 2);
        for value in rgba16.as_raw() {
            raw.extend_from_slice(&value.to_ne_bytes());
        }
        encoder.write_image(
            &raw,
            composed.width,
            composed.height,
            ExtendedColorType::Rgba16,
        )?;
    } else {
        let rgba8 = composed.rgba8.as_ref().ok_or(EncodeError::Empty)?;
        encoder.write_image(
            rgba8.as_raw(),
            composed.width,
            composed.height,
            ExtendedColorType::Rgba8,
        )?;
    }

    Ok(std::fs::metadata(output_path)?.len())
}

fn flatten_to_rgba8(composed: &Composited) -> Result<RgbaImage, EncodeError> {
    if let Some(rgba8) = &composed.rgba8 {
        return Ok(rgba8.clone());
    }
    let rgba16 = composed.rgba16.as_ref().ok_or(EncodeError::Empty)?;
    let mut out = RgbaImage::new(rgba16.width(), rgba16.height());
    for (out_pixel, in_pixel) in out.pixels_mut().zip(rgba16.pixels()) {
        *out_pixel = image::Rgba([
            (in_pixel[0] >> 8) as u8,
            (in_pixel[1] >> 8) as u8,
            (in_pixel[2] >> 8) as u8,
            (in_pixel[3] >> 8) as u8,
        ]);
    }
    Ok(out)
}

/// JPEG cannot carry alpha — blend each pixel onto white.
fn flatten_to_rgb(rgba: &RgbaImage) -> Vec<u8> {
    let mut rgb = vec![0u8; (rgba.width() * rgba.height() * 3) as usize];
    let mut i = 0;
    for pixel in rgba.pixels() {
        let alpha = pixel[3] as u16;
        if alpha == 255 {
            rgb[i] = pixel[0];
            rgb[i + 1] = pixel[1];
            rgb[i + 2] = pixel[2];
        } else if alpha == 0 {
            rgb[i] = 255;
            rgb[i + 1] = 255;
            rgb[i + 2] = 255;
        } else {
            let inv = 255 - alpha;
            for c in 0..3 {
                let v = (pixel[c] as u16 * alpha + 255 * inv) / 255;
                rgb[i + c] = v as u8;
            }
        }
        i += 3;
    }
    rgb
}

fn encode_jpeg(
    composed: &Composited,
    quality: u8,
    output_path: &Path,
) -> Result<u64, EncodeError> {
    let rgba8 = flatten_to_rgba8(composed)?;
    let rgb = flatten_to_rgb(&rgba8);
    let mut buffer = Vec::with_capacity(rgb.len() / 2);
    {
        let mut encoder =
            image::codecs::jpeg::JpegEncoder::new_with_quality(&mut buffer, quality.clamp(1, 100));
        encoder.encode(&rgb, composed.width, composed.height, ExtendedColorType::Rgb8)?;
    }
    std::fs::write(output_path, &buffer)?;
    Ok(buffer.len() as u64)
}