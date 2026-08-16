use serde::{Deserialize, Serialize};

/// Mirrors `src/models/label.ts` — keep both in sync.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "PascalCase")]
pub enum Anchor {
    TopLeft,
    TopCenter,
    TopRight,
    Center,
    BottomLeft,
    BottomCenter,
    BottomRight,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TransformConfig {
    pub anchor: Anchor,
    /// Normalized relative scale (0.01..=1.0) of the image bounding box.
    pub scale: f32,
    /// X offset — absolute pixels, or % of image width when `offset_is_percent`.
    pub offset_x: i32,
    /// Y offset — absolute pixels, or % of image height when `offset_is_percent`.
    pub offset_y: i32,
    pub offset_is_percent: bool,
}

/// Mirrors `src/models/c2pa.ts`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct C2paSettings {
    pub enabled: bool,
    pub claim_generator_name: String,
    pub claim_generator_version: String,
    pub producer_trained_on_data: bool,
    pub signer_key_path: String,
    pub signer_cert_path: String,
}

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum ExportFormat {
    Png,
    Jpeg,
}

impl ExportFormat {
    pub fn extension(self) -> &'static str {
        match self {
            ExportFormat::Png => "png",
            ExportFormat::Jpeg => "jpeg",
        }
    }

    pub fn mime(self) -> &'static str {
        match self {
            ExportFormat::Png => "image/png",
            ExportFormat::Jpeg => "image/jpeg",
        }
    }
}