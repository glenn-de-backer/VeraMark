use std::path::{Path, PathBuf};

use veramark_lib::commands::export::process_one_file;
use veramark_lib::commands::provenance::read_manifest;
use veramark_lib::engine::compositor::{compute_overlay_rect, LabelKind};
use veramark_lib::models::{Anchor, C2paSettings, ExportFormat, TransformConfig};

fn fixtures_dir() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("tests")
        .join("fixtures")
}

fn label_svg() -> PathBuf {
    Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("..")
        .join("assets")
        .join("labels")
        .join("AI-Generated.svg")
}

fn make_test_source(path: &Path, width: u32, height: u32) {
    let mut img = image::RgbaImage::new(width, height);
    for (x, y, pixel) in img.enumerate_pixels_mut() {
        *pixel = image::Rgba([
            ((x as u32 * 3) % 255) as u8,
            ((y as u32 * 5) % 255) as u8,
            120,
            255,
        ]);
    }
    img.save(path).unwrap();
}

/// The Rust geometry math must match `utils/transform.ts` exactly for
/// WYSIWYG preview/export parity.
#[test]
fn overlay_geometry_matches_type_script_spec() {
    let transform = TransformConfig {
        anchor: Anchor::BottomRight,
        scale: 0.25,
        offset_x: 0,
        offset_y: 0,
        offset_is_percent: false,
    };

    // Image 800x600 (bounding box = min = 600), label 360x160 (160/360 ratio):
    // lw = round(600 * 0.25) = 150
    // lh = round(150 * 160/360) = round(66.67) = 67
    // BottomRight pivot → x = 800 - 150 = 650, y = 600 - 67 = 533
    let rect = compute_overlay_rect(800, 600, 360, 160, &transform);
    assert_eq!((rect.w, rect.h), (150, 67));
    assert_eq!((rect.x, rect.y), (650, 533));

    // Percent offsets shift relative to the image dimensions.
    let transform_pct = TransformConfig {
        anchor: Anchor::Center,
        scale: 0.1,
        offset_x: 10,
        offset_y: -5,
        offset_is_percent: true,
        ..transform
    };
    // Image 1000x500, label 400x200: lw = 50, lh = 25.
    // anchor = (500, 250); pivot = (25, 12.5);
    // offset = (100, -25) → x = 500 - 25 + 100 = 575; y = 250 - 12.5 - 25 = 212.5 → 213
    let rect = compute_overlay_rect(1000, 500, 400, 200, &transform_pct);
    assert_eq!((rect.w, rect.h), (50, 25));
    assert_eq!((rect.x, rect.y), (575, 213));
}

#[test]
fn png_pipeline_with_c2pa_round_trip() {
    let dir = fixtures_dir();
    let source = dir.join("source.png");
    let output = dir.join("out-signed.png");
    make_test_source(&source, 1280, 800);

    let label = Some((std::fs::read(label_svg()).unwrap(), LabelKind::Svg));
    let transform = TransformConfig {
        anchor: Anchor::BottomRight,
        scale: 0.22,
        offset_x: -20,
        offset_y: -12,
        offset_is_percent: false,
    };
    let c2pa = C2paSettings {
        enabled: true,
        claim_generator_name: "VeraMark Test".to_string(),
        claim_generator_version: "0.1.0".to_string(),
        producer_trained_on_data: false,
        signer_key_path: dir.join("leaf_key_pkcs8.pem").display().to_string(),
        signer_cert_path: dir.join("signer_chain.pem").display().to_string(),
    };

    let result = process_one_file(
        &source,
        &output,
        &label,
        &transform,
        ExportFormat::Png,
        92,
        &c2pa,
    )
    .expect("pipeline should succeed");

    assert_eq!((result.width, result.height), (1280, 800));
    assert!(result.bytes_written > 0, "output file should be non-empty");
    assert!(result.manifest_signed, "manifest must be signed");
    assert_eq!(result.manifest_label.as_deref(), Some("VeraMark"));

    // Read the embedded manifest back through the same path the UI uses.
    let manifest = read_manifest(output.display().to_string())
        .expect("read_manifest must not error")
        .expect("a manifest must be present after signing");

    assert_eq!(manifest.title.as_deref(), Some("VeraMark"));
    // The claim signature verifies cryptographically (the O= attribute on the
    // signer certificate is required by the C2PA verifier).
    assert_eq!(
        manifest.signature_valid,
        Some(true),
        "signature must verify after embedding"
    );

    // Prove the cryptographic signature actually verifies: validate again
    // with our test CA configured as a user trust anchor.
    let ca_cert = std::fs::read_to_string(dir.join("ca_cert.pem")).unwrap();
    let settings = c2pa::settings::Settings::new()
        .with_json(
            &serde_json::json!({ "trust": { "user_anchors": ca_cert } }).to_string(),
        )
        .unwrap();
    let context = c2pa::Context::new().with_settings(settings).unwrap();
    let reader = c2pa::Reader::from_context(context)
        .with_file(&output)
        .unwrap();
    if !matches!(
        reader.validation_state(),
        c2pa::validation_results::ValidationState::Valid
            | c2pa::validation_results::ValidationState::Trusted
    ) {
        let json = reader.json();
        let json = &json[json.len().saturating_sub(2200)..];
        eprintln!("[anchored reader.json tail] {json}");
    }
    assert!(
        matches!(
            reader.validation_state(),
            c2pa::validation_results::ValidationState::Valid
                | c2pa::validation_results::ValidationState::Trusted
        ),
        "signature must verify against the configured trust anchor, got {:?}",
        reader.validation_state()
    );

    let _ = std::fs::remove_file(&source);
    let _ = std::fs::remove_file(&output);
}

#[test]
fn jpeg_pipeline_flattens_alpha_without_manifest() {
    let dir = fixtures_dir();
    let source = dir.join("source-alpha.png");
    let output = dir.join("out-flat.jpg");
    make_test_source(&source, 640, 480);

    let transform = TransformConfig {
        anchor: Anchor::Center,
        scale: 0.5,
        offset_x: 0,
        offset_y: 0,
        offset_is_percent: false,
    };
    let c2pa = C2paSettings {
        enabled: false,
        claim_generator_name: "VeraMark".to_string(),
        claim_generator_version: "0.1.0".to_string(),
        producer_trained_on_data: false,
        signer_key_path: String::new(),
        signer_cert_path: String::new(),
    };

    let result = process_one_file(
        &source,
        &output,
        &None,
        &transform,
        ExportFormat::Jpeg,
        90,
        &c2pa,
    )
    .expect("jpeg pipeline should succeed");

    assert_eq!((result.width, result.height), (640, 480));
    assert!(!result.manifest_signed);
    assert!(result.bytes_written > 0);

    // JPEG output must decode and carry no alpha.
    let decoded = image::open(&output).unwrap();
    assert!(!decoded.color().has_alpha());

    // No C2PA manifest should be detectable.
    let manifest = read_manifest(output.display().to_string()).unwrap();
    assert!(manifest.is_none(), "no manifest should exist for unsigned output");

    let _ = std::fs::remove_file(&source);
    let _ = std::fs::remove_file(&output);
}