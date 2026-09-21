//! solopractice desktop - Local-first clinical data management
//!
//! SECURITY: All clinical data (SOAP, Dx, CPT, audio, transcripts) stays local.
//! Nothing clinical ever syncs to the web.

mod db;
mod commands;

use tauri::Manager;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // Initialize encrypted database
            let app_data_dir = app.path().app_data_dir()
                .expect("Failed to get app data directory");
            
            std::fs::create_dir_all(&app_data_dir)
                .expect("Failed to create app data directory");
            
            let db_path = app_data_dir.join("solopractice.db");
            
            // Initialize database (encryption key would come from secure storage)
            db::init_database(&db_path)
                .expect("Failed to initialize database");
            
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_clients,
            commands::add_client,
            commands::update_consent_status,
            commands::get_sessions,
            commands::create_session,
            commands::update_session,
            commands::save_soap_note,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
