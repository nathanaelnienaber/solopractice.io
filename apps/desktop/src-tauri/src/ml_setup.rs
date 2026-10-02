//! Machine-learning tool setup: detection, download, and first-run configuration
//! for the local speech-to-text (whisper.cpp) and local drafting (Ollama) tools.
//!
//! # Design
//!
//! Nothing here ever sends clinical data anywhere. This module only:
//! - Checks whether whisper.cpp / Ollama are present on this machine.
//! - Downloads the whisper.cpp model file and (where possible) the whisper.cpp
//!   binary from their public distribution points, straight into this app's
//!   own private data directory. No admin rights, no PATH edits, no terminal.
//! - Talks to Ollama's *local* HTTP API (127.0.0.1 only) to check status and
//!   pull a model. This traffic never leaves the machine.
//!
//! If any of this fails, the app must keep working in "mock mode" for
//! transcription/drafting -- manual note entry, superbills, client list and
//! session history are never gated on whisper.cpp or Ollama being present.

use serde::{Deserialize, Serialize};
use std::io::Write;
use std::path::PathBuf;
use std::time::Duration;
use tauri::{AppHandle, Emitter, Manager};

const HF_BASE_URL: &str = "https://huggingface.co/ggerganov/whisper.cpp/resolve/main";
const OLLAMA_BASE_URL: &str = "http://127.0.0.1:11434";
const GITHUB_LATEST_RELEASE_URL: &str =
    "https://api.github.com/repos/ggml-org/whisper.cpp/releases/latest";
const DEFAULT_WHISPER_MODEL: &str = "ggml-base.en";
const DOWNLOAD_RETRY_ATTEMPTS: u32 = 3;

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct MlSetupStatus {
    pub whisper_model_downloaded: bool,
    pub whisper_model_path: Option<String>,
    pub whisper_binary_available: bool,
    pub whisper_binary_path: Option<String>,
    pub whisper_binary_download_supported: bool,
    pub ollama_installed: bool,
    pub ollama_running: bool,
    pub ollama_models: Vec<String>,
    pub recommended_model: String,
    pub recommended_whisper_model: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgress {
    pub kind: String, // "whisper-model" | "whisper-binary" | "ollama-model"
    pub label: String,
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub percent: Option<f64>,
    pub attempt: u32,
    pub done: bool,
    pub error: Option<String>,
}

fn models_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("app data dir unavailable")
        .join("models");
    std::fs::create_dir_all(&dir).ok();
    dir
}

fn bin_dir(app: &AppHandle) -> PathBuf {
    let dir = app
        .path()
        .app_data_dir()
        .expect("app data dir unavailable")
        .join("tools");
    std::fs::create_dir_all(&dir).ok();
    dir
}

fn whisper_binary_name() -> &'static str {
    if cfg!(target_os = "windows") {
        "whisper-cli.exe"
    } else {
        "whisper-cli"
    }
}

fn http_client() -> reqwest::Client {
    reqwest::Client::builder()
        .timeout(Duration::from_secs(30))
        .user_agent("SoloPractice-Desktop")
        .build()
        .expect("failed to build HTTP client")
}

/// Detect the current state of whisper.cpp + Ollama on this machine.
/// Never fails the app -- unreachable services are reported as "not running",
/// not as an error.
#[tauri::command]
pub async fn detect_ml_setup(app: AppHandle) -> Result<MlSetupStatus, String> {
    let model_path = models_dir(&app).join(format!("{DEFAULT_WHISPER_MODEL}.bin"));
    let whisper_model_downloaded = model_path.exists();

    let binary_path = bin_dir(&app).join(whisper_binary_name());
    let whisper_binary_available = binary_path.exists();

    let (ollama_running, ollama_models) = probe_ollama().await;

    Ok(MlSetupStatus {
        whisper_model_downloaded,
        whisper_model_path: if whisper_model_downloaded {
            Some(model_path.to_string_lossy().to_string())
        } else {
            None
        },
        whisper_binary_available,
        whisper_binary_path: if whisper_binary_available {
            Some(binary_path.to_string_lossy().to_string())
        } else {
            None
        },
        whisper_binary_download_supported: cfg!(target_os = "windows"),
        ollama_installed: ollama_running || ollama_common_path_exists(),
        ollama_running,
        ollama_models,
        recommended_model: "llama3.2".to_string(),
        recommended_whisper_model: DEFAULT_WHISPER_MODEL.to_string(),
    })
}

async fn probe_ollama() -> (bool, Vec<String>) {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_millis(800))
        .build();
    let Ok(client) = client else {
        return (false, vec![]);
    };

    match client.get(format!("{OLLAMA_BASE_URL}/api/tags")).send().await {
        Ok(resp) if resp.status().is_success() => {
            #[derive(Deserialize)]
            struct TagsResponse {
                models: Vec<TagModel>,
            }
            #[derive(Deserialize)]
            struct TagModel {
                name: String,
            }
            match resp.json::<TagsResponse>().await {
                Ok(parsed) => (true, parsed.models.into_iter().map(|m| m.name).collect()),
                Err(_) => (true, vec![]),
            }
        }
        _ => (false, vec![]),
    }
}

/// Best-effort check for a local Ollama install that just isn't running yet.
/// This is advisory only -- it never blocks anything if it's wrong.
fn ollama_common_path_exists() -> bool {
    let candidates: Vec<PathBuf> = if cfg!(target_os = "windows") {
        std::env::var("LOCALAPPDATA")
            .map(|p| vec![PathBuf::from(p).join("Programs\\Ollama\\ollama.exe")])
            .unwrap_or_default()
    } else if cfg!(target_os = "macos") {
        vec![
            PathBuf::from("/Applications/Ollama.app"),
            PathBuf::from("/usr/local/bin/ollama"),
        ]
    } else {
        vec![PathBuf::from("/usr/local/bin/ollama"), PathBuf::from("/usr/bin/ollama")]
    };
    candidates.iter().any(|p| p.exists())
}

/// Stream a URL to disk with progress events and automatic retry.
async fn download_with_progress(
    app: &AppHandle,
    url: &str,
    dest: &PathBuf,
    kind: &str,
    label: &str,
) -> Result<(), String> {
    use futures_util::StreamExt;

    let client = http_client();
    let mut last_err = String::new();

    for attempt in 1..=DOWNLOAD_RETRY_ATTEMPTS {
        let tmp_path = dest.with_extension("part");
        let result: Result<(), String> = async {
            let resp = client
                .get(url)
                .send()
                .await
                .map_err(|e| format!("request failed: {e}"))?;
            if !resp.status().is_success() {
                return Err(format!("server returned HTTP {}", resp.status()));
            }
            let total = resp.content_length();
            let mut file = std::fs::File::create(&tmp_path)
                .map_err(|e| format!("could not create file: {e}"))?;
            let mut downloaded: u64 = 0;
            let mut stream = resp.bytes_stream();

            while let Some(chunk) = stream.next().await {
                let chunk = chunk.map_err(|e| format!("download interrupted: {e}"))?;
                file.write_all(&chunk)
                    .map_err(|e| format!("could not write file: {e}"))?;
                downloaded += chunk.len() as u64;

                let _ = app.emit(
                    "ml-download-progress",
                    DownloadProgress {
                        kind: kind.to_string(),
                        label: label.to_string(),
                        downloaded_bytes: downloaded,
                        total_bytes: total,
                        percent: total.map(|t| (downloaded as f64 / t as f64) * 100.0),
                        attempt,
                        done: false,
                        error: None,
                    },
                );
            }
            Ok(())
        }
        .await;

        match result {
            Ok(()) => {
                std::fs::rename(&tmp_path, dest).map_err(|e| format!("could not finalize file: {e}"))?;
                let _ = app.emit(
                    "ml-download-progress",
                    DownloadProgress {
                        kind: kind.to_string(),
                        label: label.to_string(),
                        downloaded_bytes: 0,
                        total_bytes: None,
                        percent: Some(100.0),
                        attempt,
                        done: true,
                        error: None,
                    },
                );
                return Ok(());
            }
            Err(e) => {
                last_err = e;
                let _ = std::fs::remove_file(&tmp_path);
                let _ = app.emit(
                    "ml-download-progress",
                    DownloadProgress {
                        kind: kind.to_string(),
                        label: label.to_string(),
                        downloaded_bytes: 0,
                        total_bytes: None,
                        percent: None,
                        attempt,
                        done: attempt == DOWNLOAD_RETRY_ATTEMPTS,
                        error: Some(last_err.clone()),
                    },
                );
                if attempt < DOWNLOAD_RETRY_ATTEMPTS {
                    tokio::time::sleep(Duration::from_secs(2 * attempt as u64)).await;
                }
            }
        }
    }

    Err(format!(
        "Download failed after {DOWNLOAD_RETRY_ATTEMPTS} attempts: {last_err}"
    ))
}

/// Download the whisper.cpp speech-to-text model into this app's private
/// data folder. Defaults to ggml-base.en -- a good balance of speed and
/// accuracy for a typical laptop.
#[tauri::command]
pub async fn download_whisper_model(app: AppHandle, model: Option<String>) -> Result<String, String> {
    let model_name = model.unwrap_or_else(|| DEFAULT_WHISPER_MODEL.to_string());
    let url = format!("{HF_BASE_URL}/{model_name}.bin");
    let dest = models_dir(&app).join(format!("{model_name}.bin"));

    download_with_progress(&app, &url, &dest, "whisper-model", "Speech-to-text engine").await?;
    Ok(dest.to_string_lossy().to_string())
}

#[derive(Debug, Serialize, Deserialize)]
struct GithubAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Serialize, Deserialize)]
struct GithubRelease {
    assets: Vec<GithubAsset>,
}

/// Find the whisper.cpp prebuilt binary asset for this OS from the project's
/// latest GitHub release, if one exists. Returns Ok(None) rather than an
/// error when there simply isn't a matching prebuilt asset (e.g. on macOS,
/// where whisper.cpp does not currently publish a signed CLI zip) -- that is
/// an expected, non-fatal state, not a bug.
async fn find_whisper_binary_asset(app: &AppHandle) -> Result<Option<GithubAsset>, String> {
    if !cfg!(target_os = "windows") {
        // No official prebuilt CLI archive for macOS/Linux at the moment.
        // Surfaced to the UI as "automatic download not available here".
        return Ok(None);
    }
    let _ = app; // reserved for future per-OS asset caching
    let client = http_client();
    let resp = client
        .get(GITHUB_LATEST_RELEASE_URL)
        .send()
        .await
        .map_err(|e| format!("could not reach GitHub: {e}"))?;
    if !resp.status().is_success() {
        return Err(format!("GitHub returned HTTP {}", resp.status()));
    }
    let release: GithubRelease = resp
        .json()
        .await
        .map_err(|e| format!("could not parse GitHub release info: {e}"))?;

    let wanted = if cfg!(target_arch = "x86_64") {
        "whisper-bin-x64.zip"
    } else {
        "whisper-bin-Win32.zip"
    };

    Ok(release.assets.into_iter().find(|a| a.name == wanted))
}

/// Download and unpack the whisper.cpp command-line binary. Only supported
/// where a prebuilt archive exists (currently Windows x64/x86). On other
/// platforms this returns a clear "not supported here" error that the UI
/// turns into "use manual notes for now" rather than a crash.
#[tauri::command]
pub async fn download_whisper_binary(app: AppHandle) -> Result<String, String> {
    let asset = find_whisper_binary_asset(&app)
        .await?
        .ok_or_else(|| {
            "Automatic speech-to-text setup isn't available for this operating system yet. \
             You can still use SoloPractice fully with manual notes."
                .to_string()
        })?;

    let archive_path = bin_dir(&app).join(&asset.name);
    download_with_progress(
        &app,
        &asset.browser_download_url,
        &archive_path,
        "whisper-binary",
        "Speech-to-text program",
    )
    .await?;

    let extract_dir = bin_dir(&app);
    let file = std::fs::File::open(&archive_path).map_err(|e| format!("could not open archive: {e}"))?;
    let mut zip = zip::ZipArchive::new(file).map_err(|e| format!("could not read archive: {e}"))?;
    zip.extract(&extract_dir)
        .map_err(|e| format!("could not unpack archive: {e}"))?;
    let _ = std::fs::remove_file(&archive_path);

    // Older whisper.cpp releases name the binary `main.exe`; newer ones use
    // `whisper-cli.exe`. Accept either and normalize to our expected name.
    let expected = extract_dir.join(whisper_binary_name());
    if !expected.exists() {
        for candidate in ["main.exe", "whisper-cli.exe", "main", "whisper-cli"] {
            let found = extract_dir.join(candidate);
            if found.exists() {
                std::fs::rename(&found, &expected).ok();
                break;
            }
        }
    }

    if !expected.exists() {
        return Err(
            "The speech-to-text program downloaded but couldn't be found after unpacking.".to_string(),
        );
    }

    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        if let Ok(meta) = std::fs::metadata(&expected) {
            let mut perms = meta.permissions();
            perms.set_mode(0o755);
            let _ = std::fs::set_permissions(&expected, perms);
        }
    }

    Ok(expected.to_string_lossy().to_string())
}

/// Quick sanity check that a whisper.cpp binary actually runs.
#[tauri::command]
pub async fn test_whisper(whisper_path: String) -> Result<String, String> {
    let path = whisper_path.clone();
    tauri::async_runtime::spawn_blocking(move || {
        std::process::Command::new(&path)
            .arg("--help")
            .output()
            .map_err(|e| format!("Couldn't run the speech-to-text program: {e}"))
    })
    .await
    .map_err(|e| format!("internal error: {e}"))??;
    Ok("The speech-to-text program works.".to_string())
}

/// Ask Ollama to pull a model, forwarding its own streaming progress to the UI.
#[tauri::command]
pub async fn pull_ollama_model(app: AppHandle, model: String) -> Result<String, String> {
    use futures_util::StreamExt;

    let client = http_client();
    let resp = client
        .post(format!("{OLLAMA_BASE_URL}/api/pull"))
        .json(&serde_json::json!({ "name": model, "stream": true }))
        .send()
        .await
        .map_err(|e| {
            format!(
                "Couldn't reach Ollama on this computer. Is it installed and running? ({e})"
            )
        })?;

    if !resp.status().is_success() {
        return Err(format!("Ollama returned HTTP {}", resp.status()));
    }

    let mut stream = resp.bytes_stream();
    let mut buffer = String::new();
    while let Some(chunk) = stream.next().await {
        let chunk = chunk.map_err(|e| format!("Connection to Ollama dropped: {e}"))?;
        buffer.push_str(&String::from_utf8_lossy(&chunk));
        while let Some(pos) = buffer.find('\n') {
            let line = buffer[..pos].trim().to_string();
            buffer = buffer[pos + 1..].to_string();
            if line.is_empty() {
                continue;
            }
            if let Ok(v) = serde_json::from_str::<serde_json::Value>(&line) {
                let status = v.get("status").and_then(|s| s.as_str()).unwrap_or("");
                let completed = v.get("completed").and_then(|c| c.as_u64());
                let total = v.get("total").and_then(|t| t.as_u64());
                let _ = app.emit(
                    "ml-download-progress",
                    DownloadProgress {
                        kind: "ollama-model".to_string(),
                        label: format!("AI drafting model ({status})"),
                        downloaded_bytes: completed.unwrap_or(0),
                        total_bytes: total,
                        percent: match (completed, total) {
                            (Some(c), Some(t)) if t > 0 => Some((c as f64 / t as f64) * 100.0),
                            _ => None,
                        },
                        attempt: 1,
                        done: status == "success",
                        error: None,
                    },
                );
            }
        }
    }

    Ok(format!("{model} is ready."))
}

/// Confirm Ollama can actually generate with the chosen model.
#[tauri::command]
pub async fn test_ollama(model: String) -> Result<String, String> {
    let client = reqwest::Client::builder()
        .timeout(Duration::from_secs(20))
        .build()
        .map_err(|e| e.to_string())?;
    let resp = client
        .post(format!("{OLLAMA_BASE_URL}/api/generate"))
        .json(&serde_json::json!({
            "model": model,
            "prompt": "Reply with the single word OK.",
            "stream": false
        }))
        .send()
        .await
        .map_err(|e| format!("Couldn't reach Ollama: {e}"))?;

    if !resp.status().is_success() {
        return Err(format!(
            "Ollama couldn't run that model (HTTP {}). Try pulling it again.",
            resp.status()
        ));
    }
    Ok("AI drafting is working.".to_string())
}

/// Persist the chosen local-tool paths/models to the local settings table.
/// Never touches the web app.
#[tauri::command]
pub async fn save_ml_paths(
    app: AppHandle,
    whisper_path: Option<String>,
    whisper_model_path: Option<String>,
    ollama_model: Option<String>,
) -> Result<(), String> {
    let db_path = crate::db::get_db_path(&app);
    let conn = rusqlite::Connection::open(&db_path).map_err(|e| e.to_string())?;
    let pairs = [
        ("whisper_path", whisper_path),
        ("whisper_model_path", whisper_model_path),
        ("ollama_model", ollama_model),
    ];
    for (key, value) in pairs {
        if let Some(value) = value {
            conn.execute(
                "INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, datetime('now'))
                 ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = datetime('now')",
                rusqlite::params![key, value],
            )
            .map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

/// Open this app's private data folder in the OS file browser, for backups
/// and for curious users. Plain language only in the UI -- this command is
/// the "Open my data folder" button, not a path the user has to type.
#[tauri::command]
pub async fn reveal_data_folder(app: AppHandle) -> Result<(), String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("Couldn't find the data folder: {e}"))?;
    std::fs::create_dir_all(&dir).ok();
    app.shell()
        .open(dir.to_string_lossy().to_string(), None)
        .map_err(|e| format!("Couldn't open the folder: {e}"))
}

use tauri_plugin_shell::ShellExt;
