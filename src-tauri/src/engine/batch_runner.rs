use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicUsize, Ordering};

use rayon::prelude::*;
use tauri::{AppHandle, Emitter};

use crate::commands::batch::{
    BatchProgressPayload, BatchRequest, BatchResult,
};
use crate::commands::export::{self, ExportResult};

pub const BATCH_PROGRESS_EVENT: &str = "batch-progress";
pub const BATCH_COMPLETE_EVENT: &str = "batch-complete";

fn collect_image_files(dir: &Path) -> Result<Vec<PathBuf>, String> {
    let mut files = Vec::new();
    for entry in std::fs::read_dir(dir).map_err(|err| err.to_string())?.flatten() {
        let path = entry.path();
        if path.is_file() && crate::commands::batch::has_supported_image_extension(&path) {
            files.push(path);
        }
    }
    files.sort();
    Ok(files)
}

fn output_path_for(input: &Path, output_dir: &Path, extension: &str) -> PathBuf {
    let stem = input
        .file_stem()
        .and_then(|stem| stem.to_str())
        .unwrap_or("image");
    output_dir.join(format!("{stem}-marked.{extension}"))
}

/// Runs the parallel batch pipeline over the input directory, emitting
/// `batch-progress` events and a final `batch-complete` summary.
pub fn run_batch(app: &AppHandle, request: BatchRequest) -> Result<BatchResult, String> {
    let input_dir = PathBuf::from(&request.input_dir);
    let output_dir = PathBuf::from(&request.output_dir);
    std::fs::create_dir_all(&output_dir).map_err(|err| err.to_string())?;

    let files: Vec<PathBuf> = if request.files.is_empty() {
        // No explicit selection → process every supported image in the directory.
        collect_image_files(&input_dir)?
    } else {
        // Process exactly the user-selected paths (supports select/deselect).
        request.files.iter().map(PathBuf::from).collect()
    };
    let total = files.len();

    if total == 0 {
        let empty = BatchResult {
            processed: 0,
            failed: 0,
            outputs: Vec::new(),
            errors: Vec::new(),
        };
        let _ = app.emit(BATCH_COMPLETE_EVENT, &empty);
        return Ok(empty);
    }

    log::info!("batch: processing {} files from {}", total, input_dir.display());
    let label = export::load_label_owned(&request.label_id)?;

    let done = AtomicUsize::new(0);

    let per_file: Vec<Result<ExportResult, String>> = files
        .par_iter()
        .map(|input| {
            let extension = request.format.extension();
            let output = output_path_for(input, &output_dir, extension);
            let result = export::process_one_file(
                input,
                &output,
                &label,
                &request.transform,
                request.format,
                request.jpeg_quality,
                &request.c2pa,
            );

            let completed = done.fetch_add(1, Ordering::SeqCst) + 1;
            if completed == total || completed % 5 == 0 {
                let payload = BatchProgressPayload {
                    done: completed,
                    total,
                    current: input
                        .file_name()
                        .and_then(|name| name.to_str())
                        .unwrap_or("")
                        .to_string(),
                };
                let _ = app.emit(BATCH_PROGRESS_EVENT, &payload);
            }
            result
        })
        .collect();

    let mut outputs = Vec::with_capacity(per_file.len());
    let mut errors = Vec::new();
    for (entry, result) in files.iter().zip(per_file) {
        match result {
            Ok(result) => {
                log::info!("batch: {}", result.output_path);
                outputs.push(result.output_path);
            }
            Err(err) => errors.push(format!("{}: {err}", entry.display())),
        }
    }

    let summary = BatchResult {
        processed: outputs.len(),
        failed: errors.len(),
        outputs,
        errors,
    };
    let _ = app.emit(BATCH_COMPLETE_EVENT, &summary);
    log::info!(
        "batch complete: {} processed, {} failed",
        summary.processed,
        summary.failed
    );
    Ok(summary)
}