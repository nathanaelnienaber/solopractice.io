//! SoloPractice Desktop - Local-first therapy practice management
//!
//! # Security Architecture
//!
//! Clinical data (SOAP, Dx, CPT, recordings, transcripts) NEVER leaves this device.
//! Only consent status flags and client contact info sync with the web portal.

mod commands;
mod db;
mod jobs;
mod ml_setup;
mod soap_pdf;
mod superbill;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        // Updater plugin intentionally not registered: no auto-update wiring
        // for the trial (see .github/workflows/desktop-release.yml comment).
        // Registering it unconditionally panicked on startup because
        // tauri.conf.json has no plugins.updater block to deserialize
        // ("invalid type: null, expected struct Config").
        .setup(|app| {
            let app_handle = app.handle().clone();

            if let Err(e) = db::initialize_database(&app_handle) {
                eprintln!("Failed to initialize database: {}", e);
            }

            if let Err(e) = jobs::start_job_processor(&app_handle) {
                eprintln!("Failed to start job processor: {}", e);
            }

            // WebKitGTK on Linux ships `enable-media-stream` off by default
            // and denies every `permission-request` with no listener
            // override -- getUserMedia() silently rejects with
            // NotAllowedError and the OS-level mic prompt never appears.
            // Enable media capture and auto-allow only UserMedia requests
            // from our own app window (no-op on macOS/Windows, which use
            // their native WKWebView/WebView2 permission prompts instead).
            #[cfg(target_os = "linux")]
            {
                use tauri::Manager as _;
                use webkit2gtk::glib::Cast;
                use webkit2gtk::{PermissionRequestExt, SettingsExt, WebViewExt};

                if let Some(window) = app.get_webview_window("main") {
                    let _ = window.with_webview(|webview| {
                        let wk_webview = webview.inner();
                        if let Some(settings) = WebViewExt::settings(&wk_webview) {
                            settings.set_enable_media_stream(true);
                        }
                        wk_webview.connect_permission_request(|_, request| {
                            if request
                                .clone()
                                .downcast::<webkit2gtk::UserMediaPermissionRequest>()
                                .is_ok()
                            {
                                request.allow();
                                return true;
                            }
                            false
                        });
                    });
                }
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_clients,
            commands::get_client,
            commands::start_recording,
            commands::stop_recording,
            commands::save_soap_note,
            commands::save_recording_file,
            commands::get_job_queue,
            commands::save_settings,
            commands::test_web_connection,
            commands::generate_superbill_stub,
            commands::sync_consent_status,
            commands::get_client_sessions,
            commands::get_full_session,
            commands::export_soap_pdf,
            commands::open_superbill_pdf,
            ml_setup::detect_ml_setup,
            ml_setup::download_whisper_model,
            ml_setup::download_whisper_binary,
            ml_setup::test_whisper,
            ml_setup::pull_ollama_model,
            ml_setup::test_ollama,
            ml_setup::save_ml_paths,
            ml_setup::reveal_data_folder,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
