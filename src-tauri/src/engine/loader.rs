use std::path::{Path, PathBuf};
use std::sync::Mutex;

use notify::{RecommendedWatcher, Watcher};
use tauri::{AppHandle, Emitter, Manager};

pub const LABELS_ENV: &str = "VERAMARK_LABELS_DIR";
pub const LABELS_CHANGED_EVENT: &str = "labels-changed";

/// Managed state that keeps the label-directory watcher alive for the app.
pub struct LabelWatcherState(pub Mutex<Option<RecommendedWatcher>>);

#[derive(Debug, thiserror::Error)]
pub enum LoaderError {
    #[error("label directory not found: {0}")]
    NotFound(PathBuf),
    #[error(
        "no label directory found — set VERAMARK_LABELS_DIR or create assets/labels next to the exe"
    )]
    NoLabelDir,
}

/// Resolves the label directory: `VERAMARK_LABELS_DIR` wins, then common
/// dev/bundled layouts relative to the cwd and the current executable.
pub fn resolve_labels_dir() -> Result<PathBuf, LoaderError> {
    if let Ok(dir) = std::env::var(LABELS_ENV) {
        let candidate = PathBuf::from(dir);
        if candidate.is_dir() {
            return Ok(candidate);
        }
        return Err(LoaderError::NotFound(candidate));
    }

    let mut candidates: Vec<PathBuf> = vec![
        PathBuf::from("assets/labels"),
        PathBuf::from("../assets/labels"),
        PathBuf::from("../../assets/labels"),
    ];
    if let Ok(exe) = std::env::current_exe() {
        if let Some(parent) = exe.parent() {
            candidates.push(parent.join("assets/labels"));
        }
    }

    for candidate in candidates {
        if candidate.is_dir() {
            return Ok(candidate);
        }
    }
    Err(LoaderError::NoLabelDir)
}

/// List `*.svg` / `*.png` files inside the label directory (sorted).
pub fn scan_label_files(dir: &Path) -> Vec<PathBuf> {
    let Ok(entries) = std::fs::read_dir(dir) else {
        return Vec::new();
    };
    let mut files: Vec<PathBuf> = entries
        .filter_map(Result::ok)
        .map(|entry| entry.path())
        .filter(|path| {
            path.extension()
                .and_then(|ext| ext.to_str())
                .map(|ext| matches!(ext.to_ascii_lowercase().as_str(), "svg" | "png"))
                .unwrap_or(false)
        })
        .collect();
    files.sort();
    files
}

/// Starts a `notify` watcher that emits `labels:changed` when label assets
/// are added, removed, or modified at runtime.
pub fn setup_label_watcher(app: &AppHandle) -> Result<(), String> {
    let dir = match resolve_labels_dir() {
        Ok(dir) => dir,
        Err(err) => {
            log::warn!("label watcher skipped: {err}");
            return Ok(());
        }
    };

    let app_handle = app.clone();
    let mut watcher = notify::recommended_watcher(
        move |event: notify::Result<notify::Event>| {
            if let Ok(event) = event {
                let relevant = matches!(
                    event.kind,
                    notify::EventKind::Create(_) | notify::EventKind::Modify(_) | notify::EventKind::Remove(_)
                );
                if relevant {
                    let _ = app_handle.emit(LABELS_CHANGED_EVENT, ());
                }
            }
        },
    )
    .map_err(|err| err.to_string())?;

    watcher
        .watch(&dir, notify::RecursiveMode::NonRecursive)
        .map_err(|err| err.to_string())?;

    log::info!("watching labels directory: {}", dir.display());
    app.manage(LabelWatcherState(Mutex::new(Some(watcher))));
    Ok(())
}