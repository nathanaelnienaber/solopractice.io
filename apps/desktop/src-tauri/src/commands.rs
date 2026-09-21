//! Tauri commands for the desktop application
//!
//! These commands are called from the frontend via invoke().

use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Client {
    pub id: String,
    #[serde(rename = "firstName")]
    pub first_name: String,
    #[serde(rename = "lastName")]
    pub last_name: String,
    pub email: String,
    pub phone: Option<String>,
    #[serde(rename = "allConsentsSigned")]
    pub all_consents_signed: bool,
    #[serde(rename = "recordingConsentSigned")]
    pub recording_consent_signed: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SoapNote {
    pub subjective: String,
    pub objective: String,
    pub assessment: String,
    pub plan: String,
    #[serde(rename = "isDraft")]
    pub is_draft: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BackgroundJob {
    pub id: String,
    #[serde(rename = "type")]
    pub job_type: String,
    pub status: String,
    pub progress: Option<u8>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "startedAt")]
    pub started_at: Option<String>,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<String>,
    pub error: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JobQueueStats {
    pub pending: u32,
    #[serde(rename = "inProgress")]
    pub in_progress: u32,
    pub completed: u32,
    pub failed: u32,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JobQueueResponse {
    pub jobs: Vec<BackgroundJob>,
    pub stats: JobQueueStats,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Settings {
    #[serde(rename = "webApiUrl")]
    pub web_api_url: String,
    #[serde(rename = "whisperModelSize")]
    pub whisper_model_size: String,
    #[serde(rename = "ollamaModel")]
    pub ollama_model: String,
    #[serde(rename = "autoBackup")]
    pub auto_backup: bool,
    #[serde(rename = "backupPath")]
    pub backup_path: String,
}

pub struct AppState {
    pub recording_active: Mutex<bool>,
    pub current_recording_path: Mutex<Option<String>>,
}

impl Default for AppState {
    fn default() -> Self {
        Self {
            recording_active: Mutex::new(false),
            current_recording_path: Mutex::new(None),
        }
    }
}

#[tauri::command]
pub async fn get_clients() -> Result<Vec<Client>, String> {
    Ok(vec![
        Client {
            id: "client-1".to_string(),
            first_name: "Test".to_string(),
            last_name: "Client".to_string(),
            email: "test@example.com".to_string(),
            phone: None,
            all_consents_signed: true,
            recording_consent_signed: true,
        },
        Client {
            id: "client-2".to_string(),
            first_name: "Jane".to_string(),
            last_name: "Doe".to_string(),
            email: "jane@example.com".to_string(),
            phone: None,
            all_consents_signed: false,
            recording_consent_signed: false,
        },
        Client {
            id: "client-3".to_string(),
            first_name: "John".to_string(),
            last_name: "Smith".to_string(),
            email: "john@example.com".to_string(),
            phone: Some("+1 555 123 4567".to_string()),
            all_consents_signed: true,
            recording_consent_signed: true,
        },
    ])
}

#[tauri::command]
pub async fn get_client(client_id: String) -> Result<Option<Client>, String> {
    let clients = get_clients().await?;
    Ok(clients.into_iter().find(|c| c.id == client_id))
}

#[tauri::command]
pub async fn start_recording(client_id: String) -> Result<String, String> {
    let recording_id = uuid::Uuid::new_v4().to_string();
    println!(
        "[STUB] Starting recording for client {} -> {}",
        client_id, recording_id
    );
    Ok(recording_id)
}

#[tauri::command]
pub async fn stop_recording() -> Result<String, String> {
    println!("[STUB] Stopping recording, queuing transcription job");
    let job_id = uuid::Uuid::new_v4().to_string();
    Ok(job_id)
}

#[tauri::command]
pub async fn save_soap_note(client_id: String, soap_note: SoapNote) -> Result<String, String> {
    let note_id = uuid::Uuid::new_v4().to_string();
    println!(
        "[STUB] Saving SOAP note {} for client {}",
        note_id, client_id
    );
    println!("  S: {}", soap_note.subjective);
    println!("  O: {}", soap_note.objective);
    println!("  A: {}", soap_note.assessment);
    println!("  P: {}", soap_note.plan);
    Ok(note_id)
}

#[tauri::command]
pub async fn get_job_queue() -> Result<JobQueueResponse, String> {
    let now = chrono::Utc::now();

    Ok(JobQueueResponse {
        jobs: vec![
            BackgroundJob {
                id: "job-1".to_string(),
                job_type: "transcription".to_string(),
                status: "in_progress".to_string(),
                progress: Some(45),
                created_at: (now - chrono::Duration::minutes(2)).to_rfc3339(),
                started_at: Some((now - chrono::Duration::minutes(1)).to_rfc3339()),
                completed_at: None,
                error: None,
            },
            BackgroundJob {
                id: "job-2".to_string(),
                job_type: "soap_draft".to_string(),
                status: "pending".to_string(),
                progress: None,
                created_at: (now - chrono::Duration::minutes(1)).to_rfc3339(),
                started_at: None,
                completed_at: None,
                error: None,
            },
        ],
        stats: JobQueueStats {
            pending: 1,
            in_progress: 1,
            completed: 0,
            failed: 0,
        },
    })
}

#[tauri::command]
pub async fn save_settings(settings: Settings) -> Result<(), String> {
    println!("[STUB] Saving settings:");
    println!("  Web API URL: {}", settings.web_api_url);
    println!("  Whisper model: {}", settings.whisper_model_size);
    println!("  Ollama model: {}", settings.ollama_model);
    println!("  Auto backup: {}", settings.auto_backup);
    Ok(())
}

#[tauri::command]
pub async fn test_web_connection(url: String) -> Result<bool, String> {
    println!("[STUB] Testing connection to {}", url);
    Ok(true)
}

#[tauri::command]
pub async fn generate_superbill_stub() -> Result<String, String> {
    let path = "superbill_stub.pdf".to_string();
    println!("[STUB] Would generate superbill PDF at {}", path);
    Ok(path)
}

#[tauri::command]
pub async fn sync_consent_status(client_id: String) -> Result<bool, String> {
    println!("[STUB] Syncing consent status for client {}", client_id);
    Ok(true)
}
