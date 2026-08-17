pub mod commands;
pub mod engine;
pub mod models;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    env_logger::Builder::from_env(env_logger::Env::default().default_filter_or("info")).init();

    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let handle = app.handle();
            if let Err(err) = engine::loader::setup_label_watcher(handle) {
                log::warn!("label watcher failed to start: {err}");
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::labels::load_labels,
            commands::labels::refresh_labels,
            commands::labels::watch_labels,
            commands::export::preview_image,
            commands::export::process_and_export,
            commands::batch::list_batch_images,
            commands::batch::process_batch_directory,
            commands::provenance::read_manifest,
            commands::provenance::validate_signer,
            commands::settings::load_settings,
            commands::settings::save_settings
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}