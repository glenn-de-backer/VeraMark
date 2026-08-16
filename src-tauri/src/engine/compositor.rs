use std::io::BufReader;
use std::path::Path;

use image::imageops;
use image::{DynamicImage, GenericImageView, ImageDecoder, ImageReader, RgbaImage};
use usvg::Options as UsvgOptions;

use crate::models::{Anchor, TransformConfig};

/// `image` does not publicly export the 16-bit RGBA buffer type.
pub type Rgba16Image = image::ImageBuffer<image::Rgba<u16>, Vec<u16>>;

#[derive(Debug, thiserror::Error)]
pub enum CompositorError {
    #[error("unsupported image: {0}")]
    UnsupportedImage(String),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("image decode error: {0}")]
    Image(#[from] image::ImageError),
    #[error("svg parse error: {0}")]
    Svg(#[from] usvg::Error),
    #[error("svg rasterization error: {0}")]
    SvgRaster(String),
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum LabelKind {
    Svg,
    Png,
}

#[derive(Clone, Copy)]
pub struct LabelSource<'a> {
    pub bytes: &'a [u8],
    pub kind: LabelKind,
}

/// Geometry of the label rect inside the image, in image pixels.
#[derive(Debug, Clone, Copy)]
pub struct OverlayRect {
    pub x: i64,
    pub y: i64,
    pub w: u32,
    pub h: u32,
}

/// Result of composition, preserving the source depth (8-bit vs 16-bit).
pub struct Composited {
    pub rgba8: Option<RgbaImage>,
    pub rgba16: Option<Rgba16Image>,
    pub width: u32,
    pub height: u32,
    pub source_has_alpha: bool,
    pub icc: Option<Vec<u8>>,
}

pub struct ComposeInput<'a> {
    pub source_path: &'a Path,
    pub label: Option<LabelSource<'a>>,
    pub transform: &'a TransformConfig,
}

/// JS-compatible `Math.round` (half rounds towards +infinity) so the Rust
/// compositor lands on the exact same rect as the TypeScript preview.
pub fn js_round(value: f64) -> i64 {
    let floor = value.floor();
    let diff = value - floor;
    if diff < 0.5 {
        floor as i64
    } else {
        (floor + 1.0) as i64
    }
}

fn clamp_f64(value: f64, min: f64, max: f64) -> f64 {
    value.max(min).min(max)
}

fn anchor_point(anchor: Anchor, w: f64, h: f64) -> (f64, f64) {
    match anchor {
        Anchor::TopLeft => (0.0, 0.0),
        Anchor::TopCenter => (w / 2.0, 0.0),
        Anchor::TopRight => (w, 0.0),
        Anchor::Center => (w / 2.0, h / 2.0),
        Anchor::BottomLeft => (0.0, h),
        Anchor::BottomCenter => (w / 2.0, h),
        Anchor::BottomRight => (w, h),
    }
}

fn label_pivot(anchor: Anchor, w: f64, h: f64) -> (f64, f64) {
    match anchor {
        Anchor::TopLeft => (0.0, 0.0),
        Anchor::TopCenter => (w / 2.0, 0.0),
        Anchor::TopRight => (w, 0.0),
        Anchor::Center => (w / 2.0, h / 2.0),
        Anchor::BottomLeft => (0.0, h),
        Anchor::BottomCenter => (w / 2.0, h),
        Anchor::BottomRight => (w, h),
    }
}

/// Mirrors `utils/transform.ts` exactly:
/// 1. label width = min(imageW, imageH) × scale (aspect preserved)
/// 2. pivot snaps onto the cardinal anchor
/// 3. offset applied (absolute px, or % of image dims)
/// 4. clamped so the label stays fully visible
pub fn compute_overlay_rect(
    image_w: u32,
    image_h: u32,
    label_w: u32,
    label_h: u32,
    transform: &TransformConfig,
) -> OverlayRect {
    let image_w = image_w.max(1) as f64;
    let image_h = image_h.max(1) as f64;
    let base = image_w.min(image_h);

    let scale = transform.scale.clamp(0.01, 1.0) as f64;
    let label_width = (base * scale).round().max(1.0);
    let label_height = match label_w {
        0 => label_width,
        natural_w => (label_width * (label_h as f64 / natural_w as f64))
            .round()
            .max(1.0),
    };

    let (anchor_x, anchor_y) = anchor_point(transform.anchor, image_w, image_h);
    let (pivot_x, pivot_y) = label_pivot(transform.anchor, label_width, label_height);

    let offset_x = if transform.offset_is_percent {
        image_w * transform.offset_x as f64 / 100.0
    } else {
        transform.offset_x as f64
    };
    let offset_y = if transform.offset_is_percent {
        image_h * transform.offset_y as f64 / 100.0
    } else {
        transform.offset_y as f64
    };

    let raw_x = anchor_x - pivot_x + offset_x;
    let raw_y = anchor_y - pivot_y + offset_y;

    let x = js_round(clamp_f64(raw_x, 0.0, image_w - label_width));
    let y = js_round(clamp_f64(raw_y, 0.0, image_h - label_height));

    OverlayRect {
        x,
        y,
        w: label_width as u32,
        h: label_height as u32,
    }
}

fn is_16bit(img: &DynamicImage) -> bool {
    matches!(
        img,
        DynamicImage::ImageLuma16(_)
            | DynamicImage::ImageLumaA16(_)
            | DynamicImage::ImageRgb16(_)
            | DynamicImage::ImageRgba16(_)
    )
}

fn decode_icc(path: &Path) -> Option<Vec<u8>> {
    let file = std::fs::File::open(path).ok()?;
    let ext = path
        .extension()
        .and_then(|ext| ext.to_str())
        .unwrap_or("")
        .to_ascii_lowercase();
    match ext.as_str() {
        "png" => {
            let mut decoder = image::codecs::png::PngDecoder::new(BufReader::new(file)).ok()?;
            decoder.icc_profile().ok().flatten()
        }
        "jpg" | "jpeg" => {
            let mut decoder = image::codecs::jpeg::JpegDecoder::new(BufReader::new(file)).ok()?;
            decoder.icc_profile().ok().flatten()
        }
        _ => None,
    }
}

fn label_natural_size(label: &LabelSource<'_>) -> Result<(u32, u32), CompositorError> {
    match label.kind {
        LabelKind::Png => Ok(image::load_from_memory(label.bytes)?.dimensions()),
        LabelKind::Svg => {
            let tree = usvg::Tree::from_data(label.bytes, &UsvgOptions::default())?;
            let size = tree.size();
            Ok((
                size.width().max(1.0) as u32,
                size.height().max(1.0) as u32,
            ))
        }
    }
}

/// Decode a label asset and rasterize it at exactly `(width, height)`
/// (stretch both axes — identical to how an <img> fills the preview rect).
pub fn rasterize_label(
    label: &LabelSource<'_>,
    width: u32,
    height: u32,
) -> Result<RgbaImage, CompositorError> {
    match label.kind {
        LabelKind::Png => {
            let img = image::load_from_memory(label.bytes)?;
            Ok(imageops::resize(
                &img.to_rgba8(),
                width,
                height,
                imageops::FilterType::Lanczos3,
            ))
        }
        LabelKind::Svg => {
            let tree = usvg::Tree::from_data(label.bytes, &UsvgOptions::default())?;
            let size = tree.size();
            let scale_x = width as f32 / size.width().max(1.0);
            let scale_y = height as f32 / size.height().max(1.0);
            let mut pixmap = tiny_skia::Pixmap::new(width, height).ok_or_else(|| {
                CompositorError::SvgRaster("failed to allocate pixmap".to_string())
            })?;
            resvg::render(
                &tree,
                tiny_skia::Transform::from_scale(scale_x, scale_y),
                &mut pixmap.as_mut(),
            );
            Ok(
                RgbaImage::from_raw(width, height, pixmap.data().to_vec())
                    .expect("pixmap matches requested size"),
            )
        }
    }
}

fn fill_pixels16(source: &RgbaImage) -> Rgba16Image {
    Rgba16Image::from_fn(source.width(), source.height(), |x, y| {
        let p = source[(x, y)];
        image::Rgba([
            (p[0] as u16) * 257,
            (p[1] as u16) * 257,
            (p[2] as u16) * 257,
            (p[3] as u16) * 257,
        ])
    })
}

/// Loads the source, composites the label overlay at the transform rect, and
/// returns the pixel data at the source's native depth.
pub fn compose(input: ComposeInput<'_>) -> Result<Composited, CompositorError> {
    let source = ImageReader::open(input.source_path)?
        .with_guessed_format()?
        .decode()
        .map_err(|err| CompositorError::UnsupportedImage(err.to_string()))?;

    let icc = decode_icc(input.source_path);
    let source_has_alpha = source.color().has_alpha();
    let (width, height) = source.dimensions();

    let natural_size = match &input.label {
        Some(label) => label_natural_size(label)?,
        None => (0, 0),
    };

    if is_16bit(&source) {
        let mut canvas = source.into_rgba16();
        if let Some(label) = input.label {
            let rect = compute_overlay_rect(
                width,
                height,
                natural_size.0,
                natural_size.1,
                input.transform,
            );
            let rgba8 = rasterize_label(&label, rect.w, rect.h)?;
            let rgba16 = fill_pixels16(&rgba8);
            imageops::overlay(&mut canvas, &rgba16, rect.x, rect.y);
        }
        Ok(Composited {
            rgba8: None,
            rgba16: Some(canvas),
            width,
            height,
            source_has_alpha,
            icc,
        })
    } else {
        let mut canvas = source.to_rgba8();
        if let Some(label) = input.label {
            let rect = compute_overlay_rect(
                width,
                height,
                natural_size.0,
                natural_size.1,
                input.transform,
            );
            let rgba8 = rasterize_label(&label, rect.w, rect.h)?;
            imageops::overlay(&mut canvas, &rgba8, rect.x, rect.y);
        }
        Ok(Composited {
            rgba8: Some(canvas),
            rgba16: None,
            width,
            height,
            source_has_alpha,
            icc,
        })
    }
}