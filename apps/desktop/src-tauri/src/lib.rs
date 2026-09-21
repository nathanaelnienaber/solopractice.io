//! SoloPractice Desktop - Local-first therapy practice management
//!
//! # Security Architecture
//!
//! Clinical data (SOAP, Dx, CPT, recordings, transcripts) NEVER leaves this device.
//! Only consent status flags and client contact info sync with the web portal.

mod commands;
mod db;
mod jobs;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .setup(|app| {
            let app_handle = app.handle().clone();

            if let Err(e) = db::initialize_database(&app_handle) {
                eprintln!("Failed to initialize database: {}", e);
            }

            if let Err(e) = jobs::start_job_processor(&app_handle) {
                eprintln!("Failed to start job processor: {}", e);
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_clients,
            commands::get_client,
            commands::start_recording,
            commands::stop_recording,
            commands::save_soap_note,
            commands::get_job_queue,
            commands::save_settings,
            commands::test_web_connection,
            commands::generate_superbill_stub,
            commands::sync_consent_status,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
