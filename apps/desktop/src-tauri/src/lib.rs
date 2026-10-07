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

/// Surface a fatal startup failure when the UI never opens (file-manager
/// launches otherwise look like a silent abort / SIGABRT).
fn report_fatal_startup_error(error: &impl std::fmt::Display) {
    let detail = error.to_string();
    eprintln!("error while running tauri application: {detail}");

    // Match Tauri's app_data_dir for identifier com.solopractice.desktop
    // (see docs/WINDOWS_SETUP.md) so the log lands next to solopractice.db.
    let mut log_hint = String::new();
    if let Some(log_path) = startup_error_log_path() {
        if let Some(parent) = log_path.parent() {
            let _ = std::fs::create_dir_all(parent);
        }
        let body = format!(
            "SoloPractice failed to start ({})\n\n{detail}\n",
            chrono::Utc::now().to_rfc3339()
        );
        if std::fs::write(&log_path, body).is_ok() {
            log_hint = format!("\n\nDetails were also written to:\n{}", log_path.display());
        }
    }

    let message = format!(
        "SoloPractice could not start.\n\n{detail}{log_hint}\n\nIf you downloaded an older AppImage named 0.1.0, delete it and install 0.1.1 or newer."
    );

    show_native_error_dialog(&message);
}

fn startup_error_log_path() -> Option<std::path::PathBuf> {
    #[cfg(target_os = "windows")]
    {
        let base = std::env::var_os("APPDATA")?;
        Some(
            std::path::PathBuf::from(base)
                .join("com.solopractice.desktop")
                .join("solopractice-startup-error.log"),
        )
    }
    #[cfg(target_os = "macos")]
    {
        let home = std::env::var_os("HOME")?;
        Some(
            std::path::PathBuf::from(home)
                .join("Library/Application Support/com.solopractice.desktop")
                .join("solopractice-startup-error.log"),
        )
    }
    #[cfg(target_os = "linux")]
    {
        let base = std::env::var_os("XDG_DATA_HOME")
            .map(std::path::PathBuf::from)
            .or_else(|| {
                std::env::var_os("HOME")
                    .map(|h| std::path::PathBuf::from(h).join(".local/share"))
            })?;
        Some(
            base.join("com.solopractice.desktop")
                .join("solopractice-startup-error.log"),
        )
    }
    #[cfg(not(any(target_os = "windows", target_os = "macos", target_os = "linux")))]
    {
        None
    }
}

/// Best-effort OS dialog without pulling extra crates (CI rustc may be older
/// than rfd's default portal deps). Falls back to stderr-only if unavailable.
fn show_native_error_dialog(message: &str) {
    #[cfg(target_os = "linux")]
    {
        // Prefer zenity (common on desktop distros); ignore failure if absent.
        let status = std::process::Command::new("zenity")
            .args(["--error", "--title=SoloPractice", "--width=420", "--text"])
            .arg(message)
            .status();
        if matches!(status, Ok(s) if s.success()) {
            return;
        }
        let _ = std::process::Command::new("notify-send")
            .args(["SoloPractice", message])
            .status();
    }
    #[cfg(target_os = "macos")]
    {
        let escaped = message.replace('\\', "\\\\").replace('"', "\\\"");
        let script = format!("display dialog \"{escaped}\" with title \"SoloPractice\" buttons {{\"OK\"}} default button \"OK\" with icon stop");
        let _ = std::process::Command::new("osascript")
            .args(["-e", &script])
            .status();
    }
    #[cfg(target_os = "windows")]
    {
        // PowerShell MessageBox — works for double-click launches with no console.
        let escaped = message.replace('\'', "''");
        let script = format!(
            "Add-Type -AssemblyName PresentationFramework; [System.Windows.MessageBox]::Show('{escaped}','SoloPractice','OK','Error') | Out-Null"
        );
        let _ = std::process::Command::new("powershell")
            .args(["-NoProfile", "-Command", &script])
            .status();
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let result = tauri::Builder::default()
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
            // Enable media capture and auto-allow only UserMedia /
            // DeviceInfo requests from our own app window (no-op on
            // macOS/Windows, which use their native WKWebView/WebView2
            // permission prompts instead).
            #[cfg(target_os = "linux")]
            {
                use tauri::Manager as _;
                use webkit2gtk::glib::Cast;
                use webkit2gtk::{PermissionRequestExt, SettingsExt, WebViewExt};

                if let Some(window) = app.get_webview_window("main") {
                    match window.with_webview(|webview| {
                        let wk_webview = webview.inner();
                        if let Some(settings) = WebViewExt::settings(&wk_webview) {
                            settings.set_enable_media_stream(true);
                            // Extra media flags used by other Tauri Linux apps
                            // that successfully call getUserMedia (huddles /
                            // dictation). Harmless if already on.
                            settings.set_enable_webrtc(true);
                            settings.set_enable_mediasource(true);
                            settings.set_enable_media(true);
                        }
                        wk_webview.connect_permission_request(|_, request| {
                            // Mic/camera capture.
                            if request
                                .downcast_ref::<webkit2gtk::UserMediaPermissionRequest>()
                                .is_some()
                            {
                                request.allow();
                                return true;
                            }
                            // Device labels / enumerateDevices — without this,
                            // some WebKitGTK builds fail getUserMedia even for
                            // `{ audio: true }` after a soft permission prompt.
                            if request
                                .downcast_ref::<webkit2gtk::DeviceInfoPermissionRequest>()
                                .is_some()
                            {
                                request.allow();
                                return true;
                            }
                            // Deny geolocation, notifications, etc.
                            false
                        });
                    }) {
                        Ok(()) => {}
                        Err(e) => {
                            eprintln!(
                                "Failed to enable WebKitGTK media permissions (mic may not work): {e}"
                            );
                        }
                    }
                } else {
                    eprintln!(
                        "Main webview window missing at setup; cannot enable Linux mic permissions"
                    );
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
            commands::get_settings,
            commands::save_settings,
            commands::test_web_connection,
            commands::generate_superbill,
            commands::get_superbills,
            commands::get_pending_superbill_requests,
            commands::mark_superbill_request_sent,
            commands::sync_clients,
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
        .run(tauri::generate_context!());

    if let Err(error) = result {
        report_fatal_startup_error(&error);
        std::process::exit(1);
    }
}
