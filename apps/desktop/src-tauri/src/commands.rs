//! Tauri commands for the desktop application
//!
//! These commands are called from the frontend via invoke().

use crate::db;
use crate::soap_pdf::{generate_soap_pdf, SoapPdfData};
use rusqlite::OptionalExtension;
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::{AppHandle, Manager, State};
use tauri_plugin_shell::ShellExt;

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
    /// Raw JSON payload (includes sessionId for filtering in the UI).
    pub payload: Option<String>,
    #[serde(rename = "createdAt")]
    pub created_at: String,
    #[serde(rename = "startedAt")]
    pub started_at: Option<String>,
    #[serde(rename = "completedAt")]
    pub completed_at: Option<String>,
    pub error: Option<String>,
    pub result: Option<String>,
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
    /// Desktop API key (format `sp_desktop_<...>`) minted on the web portal's
    /// Settings > Desktop App page. Optional because existing local settings
    /// rows predate this field and because a therapist may save webApiUrl
    /// before generating a key. Stored as plain text in the local `settings`
    /// table -- same trust boundary as webApiUrl, not a secret relative to
    /// this machine's own disk (it IS a secret relative to the network, so
    /// it is only ever sent over HTTPS/loopback-equivalent to the web portal
    /// and never logged).
    #[serde(rename = "apiKey")]
    pub api_key: Option<String>,
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

fn query_clients(conn: &rusqlite::Connection) -> Result<Vec<Client>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, first_name, last_name, email, phone,
                   all_consents_signed, recording_consent_signed
            FROM clients
            ORDER BY last_name, first_name
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(Client {
                id: row.get(0)?,
                first_name: row.get(1)?,
                last_name: row.get(2)?,
                email: row.get(3)?,
                phone: row.get(4)?,
                all_consents_signed: row.get::<_, i64>(5)? != 0,
                recording_consent_signed: row.get::<_, i64>(6)? != 0,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

fn query_client_by_id(conn: &rusqlite::Connection, client_id: &str) -> Result<Option<Client>, String> {
    conn.query_row(
        r#"
        SELECT id, first_name, last_name, email, phone,
               all_consents_signed, recording_consent_signed
        FROM clients WHERE id = ?1
        "#,
        [client_id],
        |row| {
            Ok(Client {
                id: row.get(0)?,
                first_name: row.get(1)?,
                last_name: row.get(2)?,
                email: row.get(3)?,
                phone: row.get(4)?,
                all_consents_signed: row.get::<_, i64>(5)? != 0,
                recording_consent_signed: row.get::<_, i64>(6)? != 0,
            })
        },
    )
    .optional()
    .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_clients(app: AppHandle) -> Result<Vec<Client>, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    query_clients(&conn)
}

#[tauri::command]
pub async fn get_client(app: AppHandle, client_id: String) -> Result<Option<Client>, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    query_client_by_id(&conn, &client_id)
}

// NOTE: there is deliberately no create_client command. Clients are
// authored on the web portal (where intake + consent forms live) and sync
// one-way down to desktop -- see ClientList.tsx's "Add Client" help text.
// A desktop-side create_client existed briefly but was removed: a client
// created locally had no path to ever get consent signed, since consent
// capture only exists on the web portal today.

/// Gate A / product rule: recording requires recording consent on file.
/// Shared by `start_recording` and unit tests so the check cannot drift
/// from the SQL shape used by sync.
fn assert_recording_allowed(conn: &rusqlite::Connection, client_id: &str) -> Result<(), String> {
    let client = query_client_by_id(conn, client_id)?
        .ok_or_else(|| "Client not found".to_string())?;
    if !client.recording_consent_signed {
        return Err(
            "Recording blocked: session recording consent is not signed. Send the consent link from the web portal."
                .to_string(),
        );
    }
    Ok(())
}

fn insert_new_session(conn: &rusqlite::Connection, client_id: &str) -> Result<String, String> {
    assert_recording_allowed(conn, client_id)?;
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        r#"
        INSERT INTO sessions (id, client_id, status, started_at)
        VALUES (?1, ?2, 'in_progress', datetime('now'))
        "#,
        rusqlite::params![&id, client_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

fn enqueue_job(
    conn: &rusqlite::Connection,
    job_type: &str,
    payload_json: &str,
) -> Result<String, String> {
    let id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        r#"
        INSERT INTO jobs (id, job_type, status, payload)
        VALUES (?1, ?2, 'pending', ?3)
        "#,
        rusqlite::params![&id, job_type, payload_json],
    )
    .map_err(|e| e.to_string())?;
    Ok(id)
}

fn mark_session_ended(conn: &rusqlite::Connection, session_id: &str) -> Result<(), String> {
    conn.execute(
        "UPDATE sessions SET status = 'recorded', ended_at = datetime('now') WHERE id = ?1",
        [session_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn upsert_soap_note(
    conn: &rusqlite::Connection,
    session_id: &str,
    client_id: &str,
    subjective: &str,
    objective: &str,
    assessment: &str,
    plan: &str,
    is_draft: bool,
) -> Result<String, String> {
    let existing: Option<String> = conn
        .query_row(
            "SELECT id FROM soap_notes WHERE session_id = ?1",
            [session_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let note_id = match existing {
        Some(id) => {
            if is_draft {
                conn.execute(
                    r#"
                    UPDATE soap_notes
                    SET subjective = ?1, objective = ?2, assessment = ?3, plan = ?4,
                        is_draft = 1, signed_at = NULL, signed_by = NULL,
                        updated_at = datetime('now')
                    WHERE id = ?5
                    "#,
                    rusqlite::params![subjective, objective, assessment, plan, id],
                )
                .map_err(|e| e.to_string())?;
            } else {
                conn.execute(
                    r#"
                    UPDATE soap_notes
                    SET subjective = ?1, objective = ?2, assessment = ?3, plan = ?4,
                        is_draft = 0,
                        signed_at = COALESCE(signed_at, datetime('now')),
                        signed_by = COALESCE(signed_by, 'therapist'),
                        updated_at = datetime('now')
                    WHERE id = ?5
                    "#,
                    rusqlite::params![subjective, objective, assessment, plan, id],
                )
                .map_err(|e| e.to_string())?;
            }
            id
        }
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            if is_draft {
                conn.execute(
                    r#"
                    INSERT INTO soap_notes (id, session_id, client_id, subjective, objective, assessment, plan, is_draft)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 1)
                    "#,
                    rusqlite::params![&id, session_id, client_id, subjective, objective, assessment, plan],
                )
                .map_err(|e| e.to_string())?;
            } else {
                conn.execute(
                    r#"
                    INSERT INTO soap_notes (id, session_id, client_id, subjective, objective, assessment, plan, is_draft, signed_at, signed_by)
                    VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, 0, datetime('now'), 'therapist')
                    "#,
                    rusqlite::params![&id, session_id, client_id, subjective, objective, assessment, plan],
                )
                .map_err(|e| e.to_string())?;
            }
            id
        }
    };

    conn.execute(
        "UPDATE sessions SET soap_note_id = ?1 WHERE id = ?2",
        rusqlite::params![&note_id, session_id],
    )
    .map_err(|e| e.to_string())?;

    Ok(note_id)
}

#[tauri::command]
pub async fn start_recording(app: AppHandle, client_id: String) -> Result<String, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    insert_new_session(&conn, &client_id)
}

#[tauri::command]
pub async fn stop_recording(app: AppHandle, session_id: String) -> Result<(), String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    mark_session_ended(&conn, &session_id)
}

#[tauri::command]
pub async fn save_soap_note(
    app: AppHandle,
    session_id: String,
    client_id: String,
    soap_note: SoapNote,
) -> Result<String, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    upsert_soap_note(
        &conn,
        &session_id,
        &client_id,
        &soap_note.subjective,
        &soap_note.objective,
        &soap_note.assessment,
        &soap_note.plan,
        soap_note.is_draft,
    )
}

fn query_job_queue(conn: &rusqlite::Connection) -> Result<JobQueueResponse, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, job_type, status, progress, payload, created_at, started_at, completed_at, error, result
            FROM jobs
            ORDER BY created_at DESC
            LIMIT 50
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(BackgroundJob {
                id: row.get(0)?,
                job_type: row.get(1)?,
                status: row.get(2)?,
                progress: row.get(3)?,
                payload: row.get(4)?,
                created_at: row.get(5)?,
                started_at: row.get(6)?,
                completed_at: row.get(7)?,
                error: row.get(8)?,
                result: row.get(9)?,
            })
        })
        .map_err(|e| e.to_string())?;

    let jobs: Vec<BackgroundJob> = rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())?;

    let count_by_status = |status: &str| -> Result<u32, String> {
        conn.query_row(
            "SELECT COUNT(*) FROM jobs WHERE status = ?1",
            [status],
            |r| r.get::<_, i64>(0),
        )
        .map(|n| n as u32)
        .map_err(|e| e.to_string())
    };

    let stats = JobQueueStats {
        pending: count_by_status("pending")?,
        in_progress: count_by_status("in_progress")?,
        completed: count_by_status("completed")?,
        failed: count_by_status("failed")?,
    };

    Ok(JobQueueResponse { jobs, stats })
}

#[tauri::command]
pub async fn get_job_queue(app: AppHandle) -> Result<JobQueueResponse, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    query_job_queue(&conn)
}

/// Persist the full SettingsState shape into the local `settings` key/value
/// table, following the exact pattern established by `save_ml_paths` in
/// ml_setup.rs (one row per key, UPSERT on conflict). Takes a connection
/// directly so the storage logic can be unit tested against a real
/// in-memory SQLite table without needing an AppHandle.
fn persist_settings(conn: &rusqlite::Connection, settings: &Settings) -> Result<(), String> {
    let pairs: [(&str, Option<String>); 6] = [
        ("web_api_url", Some(settings.web_api_url.clone())),
        ("desktop_api_key", settings.api_key.clone()),
        ("whisper_model_size", Some(settings.whisper_model_size.clone())),
        ("ollama_model", Some(settings.ollama_model.clone())),
        ("auto_backup", Some(settings.auto_backup.to_string())),
        ("backup_path", Some(settings.backup_path.clone())),
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

/// Read a single setting value out of the local `settings` table, or None
/// if it was never saved. Mirrors the closure used in jobs.rs's job
/// processor (`get_setting`), pulled out here so sync_clients and
/// test_web_connection can share it.
fn read_setting(conn: &rusqlite::Connection, key: &str) -> Option<String> {
    conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get(0))
        .optional()
        .ok()
        .flatten()
}

/// Read the full Settings shape back out of the local `settings` table,
/// the inverse of persist_settings. Missing keys fall back to the same
/// defaults Settings.tsx's initial useState used, except web_api_url,
/// which now defaults to the real production portal instead of a
/// localhost dev URL -- a real trial user has no reason to know about
/// port 3847, and a stale localhost default looked indistinguishable
/// from "it saved the wrong thing" the first time this was tested by hand.
fn read_settings(conn: &rusqlite::Connection) -> Settings {
    Settings {
        web_api_url: read_setting(conn, "web_api_url")
            .unwrap_or_else(|| "https://www.solopractice.io".to_string()),
        api_key: read_setting(conn, "desktop_api_key"),
        whisper_model_size: read_setting(conn, "whisper_model_size")
            .unwrap_or_else(|| "base".to_string()),
        ollama_model: read_setting(conn, "ollama_model").unwrap_or_else(|| "llama3.2".to_string()),
        auto_backup: read_setting(conn, "auto_backup")
            .map(|v| v == "true")
            .unwrap_or(true),
        backup_path: read_setting(conn, "backup_path").unwrap_or_default(),
    }
}

#[tauri::command]
pub async fn get_settings(app: AppHandle) -> Result<Settings, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    Ok(read_settings(&conn))
}

#[tauri::command]
pub async fn save_settings(app: AppHandle, settings: Settings) -> Result<(), String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    persist_settings(&conn, &settings)
}

/// Desktop sync API response shapes, mirroring apps/web/src/app/api/desktop/sync/route.ts.
/// Only non-PHI fields (contact info + consent flags) -- see that route's doc comment.
#[derive(Debug, Deserialize)]
struct SyncResponse {
    clients: Vec<SyncClient>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
struct SyncClient {
    id: String,
    first_name: String,
    last_name: String,
    email: String,
    phone: Option<String>,
    all_consents_signed: bool,
    recording_consent_signed: bool,
}

const DESKTOP_API_KEY_HEADER: &str = "X-Desktop-API-Key";

fn sync_http_client() -> Result<reqwest::Client, String> {
    reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(15))
        .user_agent("SoloPractice-Desktop")
        .build()
        .map_err(|e| e.to_string())
}

/// Upsert one client row returned by the web portal's sync endpoint into the
/// local clients table.
///
/// ID-MATCHING DESIGN DECISION: the web portal's client id (Postgres `text`
/// primary key, see apps/web/src/db/schema.ts `clients.id`) is used directly
/// as the desktop SQLite clients.id (also `TEXT PRIMARY KEY`, see db.rs).
/// Both sides already use the same opaque string id scheme (no numeric vs.
/// UUID mismatch to reconcile), so no separate "remote id" column or mapping
/// table is introduced -- the web id IS the local id. This keeps the upsert
/// a plain `ON CONFLICT(id) DO UPDATE` and means re-running sync is
/// idempotent and order-independent.
fn upsert_synced_client(conn: &rusqlite::Connection, client: &SyncClient) -> Result<(), String> {
    conn.execute(
        r#"
        INSERT INTO clients (id, first_name, last_name, email, phone, all_consents_signed, recording_consent_signed, updated_at)
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, datetime('now'))
        ON CONFLICT(id) DO UPDATE SET
            first_name = excluded.first_name,
            last_name = excluded.last_name,
            email = excluded.email,
            phone = excluded.phone,
            all_consents_signed = excluded.all_consents_signed,
            recording_consent_signed = excluded.recording_consent_signed,
            updated_at = datetime('now')
        "#,
        rusqlite::params![
            client.id,
            client.first_name,
            client.last_name,
            client.email,
            client.phone,
            client.all_consents_signed as i64,
            client.recording_consent_signed as i64,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

/// Fetch the client list from the web portal's real sync endpoint
/// (GET {web_api_url}/api/desktop/sync, X-Desktop-API-Key header) and
/// return the parsed client list. Pure HTTP + parsing, no SQLite -- kept
/// separate from upsert_synced_client so each half can be tested on its own
/// (this half against a real local test HTTP server, the other half against
/// a real in-memory SQLite table).
async fn fetch_sync_clients(web_api_url: &str, api_key: &str) -> Result<Vec<SyncClient>, String> {
    let client = sync_http_client()?;
    let url = format!("{}/api/desktop/sync", web_api_url.trim_end_matches('/'));

    let resp = client
        .get(&url)
        .header(DESKTOP_API_KEY_HEADER, api_key)
        .send()
        .await
        .map_err(|e| format!("Couldn't reach the web portal at {}: {}", web_api_url, e))?;

    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err(
            "The web portal rejected this API key. Generate a new one in Settings > Desktop App on the web portal."
                .to_string(),
        );
    }
    if !resp.status().is_success() {
        return Err(format!("Web portal returned HTTP {}", resp.status()));
    }

    let parsed: SyncResponse = resp
        .json()
        .await
        .map_err(|e| format!("Web portal returned an unparseable response: {}", e))?;

    Ok(parsed.clients)
}

/// Real sync command: reads webApiUrl + the desktop API key from the local
/// settings table, fetches the therapist's client list + consent status
/// from the web portal, and upserts each client into the local clients
/// table. Returns the number of clients synced. Manual-trigger only (the
/// "Sync Now" button) -- no background polling by design.
#[tauri::command]
pub async fn sync_clients(app: AppHandle) -> Result<u32, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;

    let web_api_url = read_setting(&conn, "web_api_url")
        .filter(|v| !v.trim().is_empty())
        .ok_or_else(|| "Set the web portal address in Settings first.".to_string())?;
    let api_key = read_setting(&conn, "desktop_api_key")
        .filter(|v| !v.trim().is_empty())
        .ok_or_else(|| {
            "No desktop API key saved. Generate one on the web portal (Settings > Desktop App) and paste it in here first.".to_string()
        })?;

    let clients = fetch_sync_clients(&web_api_url, &api_key).await?;
    let count = clients.len() as u32;

    for client in &clients {
        upsert_synced_client(&conn, client)?;
    }

    Ok(count)
}

/// Real connectivity check for the "Test" button next to the web portal URL
/// field. There is no dedicated /api/health route on the web app, so this
/// makes the same authenticated request sync_clients would make and treats
/// HTTP 200 as "reachable and the key (if any) works" and HTTP 401 as
/// "reachable, but the key is missing/wrong" -- both are a successful
/// *connection* test distinct from a network failure (DNS/refused/timeout),
/// which is what this command should actually be answering.
#[tauri::command]
pub async fn test_web_connection(app: AppHandle, url: String) -> Result<bool, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    let api_key = read_setting(&conn, "desktop_api_key").unwrap_or_default();

    let client = sync_http_client()?;
    let endpoint = format!("{}/api/desktop/sync", url.trim_end_matches('/'));

    let resp = client
        .get(&endpoint)
        .header(DESKTOP_API_KEY_HEADER, api_key)
        .send()
        .await
        .map_err(|e| format!("Couldn't reach {}: {}", url, e))?;

    match resp.status() {
        reqwest::StatusCode::OK | reqwest::StatusCode::UNAUTHORIZED => Ok(true),
        other => Err(format!("Web portal returned HTTP {}", other)),
    }
}

// ---------------------------------------------------------------------------
// Superbill PDF (local only — Dx/CPT never leave this machine)
// ---------------------------------------------------------------------------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct GenerateSuperbillInput {
    pub session_id: Option<String>,
    /// When fulfilling a web request, the paid invoice id (ops link only).
    pub web_invoice_id: Option<String>,
    pub client_id: String,
    pub client_name: String,
    pub client_dob: Option<String>,
    pub client_address: Option<String>,
    pub client_phone: Option<String>,
    pub service_date: String,
    pub diagnosis_codes: Vec<DiagnosisCodeInput>,
    pub service_codes: Vec<ServiceCodeInput>,
    pub therapist_info: TherapistInfoInput,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DiagnosisCodeInput {
    pub code: String,
    pub description: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ServiceCodeInput {
    pub cpt_code: String,
    pub description: String,
    pub units: u32,
    pub charge_cents: u32,
    pub diagnosis_pointer: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TherapistInfoInput {
    pub practice_name: String,
    pub therapist_name: String,
    pub credentials: String,
    pub npi_number: Option<String>,
    pub tax_id: Option<String>,
    pub address_street: String,
    pub address_city: String,
    pub address_state: String,
    pub address_zip: String,
    pub phone: Option<String>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SuperbillRecord {
    pub id: String,
    pub client_name: String,
    pub service_date: String,
    pub total_amount_cents: i64,
    pub pdf_path: String,
    pub created_at: String,
}

fn insert_superbill_record(
    conn: &rusqlite::Connection,
    id: &str,
    session_id: Option<&str>,
    client_id: &str,
    service_date: &str,
    diagnosis_codes_json: &str,
    procedure_codes_json: &str,
    total_amount_cents: i64,
    pdf_path: &str,
) -> Result<(), String> {
    conn.execute(
        r#"
        INSERT INTO superbills (
            id, session_id, client_id, service_date,
            diagnosis_codes, procedure_codes, total_amount_cents, pdf_path
        )
        VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
        "#,
        rusqlite::params![
            id,
            session_id,
            client_id,
            service_date,
            diagnosis_codes_json,
            procedure_codes_json,
            total_amount_cents,
            pdf_path,
        ],
    )
    .map_err(|e| e.to_string())?;
    Ok(())
}

fn query_superbills(conn: &rusqlite::Connection) -> Result<Vec<SuperbillRecord>, String> {
    let mut stmt = conn
        .prepare(
            r#"
            SELECT sb.id,
                   COALESCE(c.first_name || ' ' || c.last_name, 'Unknown'),
                   sb.service_date,
                   sb.total_amount_cents,
                   COALESCE(sb.pdf_path, ''),
                   sb.created_at
            FROM superbills sb
            LEFT JOIN clients c ON c.id = sb.client_id
            ORDER BY sb.created_at DESC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([], |row| {
            Ok(SuperbillRecord {
                id: row.get(0)?,
                client_name: row.get(1)?,
                service_date: row.get(2)?,
                total_amount_cents: row.get(3)?,
                pdf_path: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>()
        .map_err(|e| e.to_string())
}

/// Render a superbill PDF to `$APPDATA/superbills/`, persist a local DB row,
/// and return the absolute path. Clinical codes stay on this machine only.
#[tauri::command]
pub async fn generate_superbill(
    app: AppHandle,
    input: GenerateSuperbillInput,
) -> Result<String, String> {
    if input.client_id.is_empty() {
        return Err("clientId is required".to_string());
    }
    let dob = input
        .client_dob
        .as_ref()
        .map(|s| s.trim())
        .filter(|s| !s.is_empty());
    if dob.is_none() {
        return Err("Client date of birth is required for a superbill".to_string());
    }
    if input.diagnosis_codes.is_empty() {
        return Err("At least one diagnosis code is required".to_string());
    }
    if input.service_codes.is_empty() {
        return Err("At least one service code is required".to_string());
    }
    if input.therapist_info.practice_name.trim().is_empty()
        || input.therapist_info.therapist_name.trim().is_empty()
    {
        return Err("Practice name and therapist name are required".to_string());
    }
    if input.therapist_info.credentials.trim().is_empty() {
        return Err("Credentials are required".to_string());
    }
    if input.therapist_info.address_street.trim().is_empty()
        || input.therapist_info.address_city.trim().is_empty()
        || input.therapist_info.address_state.trim().is_empty()
        || input.therapist_info.address_zip.trim().is_empty()
    {
        return Err(
            "Provider street, city, state, and ZIP are required for the letterhead".to_string(),
        );
    }
    if input.service_date.trim().is_empty() {
        return Err("Service date is required".to_string());
    }

    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;

    let client_exists: bool = conn
        .query_row(
            "SELECT 1 FROM clients WHERE id = ?1",
            [&input.client_id],
            |_| Ok(true),
        )
        .optional()
        .map_err(|e| e.to_string())?
        .unwrap_or(false);
    if !client_exists {
        return Err(format!("Client {} not found locally — sync clients first", input.client_id));
    }

    if let Some(ref session_id) = input.session_id {
        let session_ok: bool = conn
            .query_row(
                "SELECT 1 FROM sessions WHERE id = ?1",
                [session_id],
                |_| Ok(true),
            )
            .optional()
            .map_err(|e| e.to_string())?
            .unwrap_or(false);
        if !session_ok {
            return Err(format!("Session {} not found", session_id));
        }
    }

    let total_amount_cents: i64 = input
        .service_codes
        .iter()
        .map(|s| (s.charge_cents as i64) * (s.units as i64))
        .sum();

    let invoice_id = input
        .web_invoice_id
        .filter(|s| !s.trim().is_empty())
        .unwrap_or_else(|| uuid::Uuid::new_v4().to_string());
    let invoice_short = invoice_id.chars().take(8).collect::<String>();
    let invoice_number = format!("SB-{}", invoice_short.to_uppercase());

    let diagnosis_codes_json = serde_json::to_string(
        &input
            .diagnosis_codes
            .iter()
            .map(|d| serde_json::json!({ "code": d.code, "description": d.description }))
            .collect::<Vec<_>>(),
    )
    .map_err(|e| e.to_string())?;

    let procedure_codes_json = serde_json::to_string(
        &input
            .service_codes
            .iter()
            .map(|s| {
                serde_json::json!({
                    "cptCode": s.cpt_code,
                    "description": s.description,
                    "units": s.units,
                    "chargeCents": s.charge_cents,
                    "diagnosisPointer": s.diagnosis_pointer,
                })
            })
            .collect::<Vec<_>>(),
    )
    .map_err(|e| e.to_string())?;

    let pdf_data = crate::superbill::SuperbillData {
        therapist: crate::superbill::TherapistInfo {
            practice_name: input.therapist_info.practice_name,
            therapist_name: input.therapist_info.therapist_name,
            credentials: input.therapist_info.credentials,
            npi_number: input.therapist_info.npi_number,
            tax_id: input.therapist_info.tax_id,
            address_street: input.therapist_info.address_street,
            address_city: input.therapist_info.address_city,
            address_state: input.therapist_info.address_state,
            address_zip: input.therapist_info.address_zip,
            phone: input.therapist_info.phone,
        },
        client: crate::superbill::ClientInfo {
            name: input.client_name,
            address: input.client_address,
            phone: input.client_phone,
            date_of_birth: input.client_dob,
        },
        diagnosis_codes: input
            .diagnosis_codes
            .iter()
            .map(|d| (d.code.clone(), d.description.clone()))
            .collect(),
        services: input
            .service_codes
            .iter()
            .map(|s| crate::superbill::ServiceLine {
                date: input.service_date.clone(),
                cpt_code: s.cpt_code.clone(),
                cpt_description: s.description.clone(),
                diagnosis_pointer: s.diagnosis_pointer.clone(),
                units: s.units,
                charge_cents: s.charge_cents,
            })
            .collect(),
        invoice_number,
        invoice_date: input.service_date.clone(),
    };

    let superbills_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("superbills");
    std::fs::create_dir_all(&superbills_dir).map_err(|e| e.to_string())?;

    let file_name = format!("superbill_{}.pdf", invoice_short);
    let output_path = superbills_dir.join(&file_name);

    crate::superbill::generate_superbill_pdf(&pdf_data, &output_path)?;

    let pdf_path = output_path.to_string_lossy().to_string();
    insert_superbill_record(
        &conn,
        &invoice_id,
        input.session_id.as_deref(),
        &input.client_id,
        &input.service_date,
        &diagnosis_codes_json,
        &procedure_codes_json,
        total_amount_cents,
        &pdf_path,
    )?;

    Ok(pdf_path)
}

#[tauri::command]
pub async fn get_superbills(app: AppHandle) -> Result<Vec<SuperbillRecord>, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    query_superbills(&conn)
}

// ---------------------------------------------------------------------------
// Session history
//
// Everything below reads/writes the local SQLite database only (see db.rs
// for the schema). No network calls -- this is the client-session-history
// feature: list a client's past sessions, drill into one session's
// transcript + SOAP note, and export a finalized SOAP note to a local PDF.
// ---------------------------------------------------------------------------

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionInfo {
    pub id: String,
    pub client_id: String,
    pub status: String,
    pub has_recording: bool,
    pub has_transcript: bool,
    pub has_soap_note: bool,
    pub soap_is_draft: Option<bool>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TranscriptData {
    pub id: String,
    pub session_id: String,
    pub content: String,
    pub model_used: Option<String>,
    pub created_at: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionSoapNote {
    pub id: Option<String>,
    pub subjective: String,
    pub objective: String,
    pub assessment: String,
    pub plan: String,
    pub is_draft: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FullSessionClient {
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FullSessionData {
    pub session: SessionInfo,
    pub client: FullSessionClient,
    pub transcript: Option<TranscriptData>,
    pub soap_note: Option<SessionSoapNote>,
}

/// List every session recorded for a client, newest first, with cheap
/// boolean flags the UI uses to badge each row (recorded / transcribed /
/// draft / finalized) without pulling the full transcript/SOAP text.
#[tauri::command]
pub async fn get_client_sessions(
    app: AppHandle,
    client_id: String,
) -> Result<Vec<SessionInfo>, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;

    let mut stmt = conn
        .prepare(
            r#"
            SELECT
                s.id,
                s.client_id,
                s.status,
                EXISTS(SELECT 1 FROM recordings r WHERE r.session_id = s.id) AS has_recording,
                EXISTS(SELECT 1 FROM transcripts t WHERE t.session_id = s.id) AS has_transcript,
                sn.id IS NOT NULL AS has_soap_note,
                sn.is_draft AS soap_is_draft
            FROM sessions s
            LEFT JOIN soap_notes sn ON sn.session_id = s.id
            WHERE s.client_id = ?1
            ORDER BY s.created_at DESC
            "#,
        )
        .map_err(|e| e.to_string())?;

    let rows = stmt
        .query_map([&client_id], |row| {
            let soap_is_draft: Option<i64> = row.get(6)?;
            Ok(SessionInfo {
                id: row.get(0)?,
                client_id: row.get(1)?,
                status: row.get(2)?,
                has_recording: row.get::<_, i64>(3)? != 0,
                has_transcript: row.get::<_, i64>(4)? != 0,
                has_soap_note: row.get::<_, i64>(5)? != 0,
                soap_is_draft: soap_is_draft.map(|v| v != 0),
            })
        })
        .map_err(|e| e.to_string())?;

    rows.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Load everything needed to render the session detail view: the session's
/// own status flags, the client it belongs to, its transcript (if any) and
/// its most recent SOAP note (if any). Returns `None` if the session id
/// doesn't exist, mirroring `get_client`'s Option-on-not-found style.
#[tauri::command]
pub async fn get_full_session(
    app: AppHandle,
    session_id: String,
) -> Result<Option<FullSessionData>, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;

    let session_row = conn
        .query_row(
            r#"
            SELECT
                s.id,
                s.client_id,
                s.status,
                EXISTS(SELECT 1 FROM recordings r WHERE r.session_id = s.id) AS has_recording,
                EXISTS(SELECT 1 FROM transcripts t WHERE t.session_id = s.id) AS has_transcript,
                c.id, c.first_name, c.last_name, c.email
            FROM sessions s
            JOIN clients c ON c.id = s.client_id
            WHERE s.id = ?1
            "#,
            [&session_id],
            |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, String>(1)?,
                    row.get::<_, String>(2)?,
                    row.get::<_, i64>(3)? != 0,
                    row.get::<_, i64>(4)? != 0,
                    FullSessionClient {
                        id: row.get(5)?,
                        first_name: row.get(6)?,
                        last_name: row.get(7)?,
                        email: row.get(8)?,
                    },
                ))
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let Some((id, client_id, status, has_recording, has_transcript, client)) = session_row else {
        return Ok(None);
    };

    let transcript = conn
        .query_row(
            r#"
            SELECT id, session_id, content, model_used, created_at
            FROM transcripts
            WHERE session_id = ?1
            ORDER BY created_at DESC
            LIMIT 1
            "#,
            [&id],
            |row| {
                Ok(TranscriptData {
                    id: row.get(0)?,
                    session_id: row.get(1)?,
                    content: row.get(2)?,
                    model_used: row.get(3)?,
                    created_at: row.get(4)?,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let soap_note = conn
        .query_row(
            r#"
            SELECT id, subjective, objective, assessment, plan, is_draft
            FROM soap_notes
            WHERE session_id = ?1
            ORDER BY updated_at DESC
            LIMIT 1
            "#,
            [&id],
            |row| {
                Ok(SessionSoapNote {
                    id: Some(row.get(0)?),
                    subjective: row.get(1)?,
                    objective: row.get(2)?,
                    assessment: row.get(3)?,
                    plan: row.get(4)?,
                    is_draft: row.get::<_, i64>(5)? != 0,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let has_soap_note = soap_note.is_some();

    Ok(Some(FullSessionData {
        session: SessionInfo {
            id,
            client_id,
            status,
            has_recording,
            has_transcript,
            has_soap_note,
            soap_is_draft: soap_note.as_ref().map(|s| s.is_draft),
        },
        client,
        transcript,
        soap_note,
    }))
}

/// Compact job row for the session recording → SOAP pipeline status UI.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionJobStatus {
    pub id: String,
    pub job_type: String,
    pub status: String,
    pub progress: Option<u8>,
    pub error: Option<String>,
    pub created_at: String,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

/// Everything the Session panel needs to show transcription / SOAP progress
/// without leaving the therapist staring at a blank editor.
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SessionPipelineStatus {
    pub session_id: String,
    pub has_recording: bool,
    pub recording_path: Option<String>,
    pub has_transcript: bool,
    pub transcription_job: Option<SessionJobStatus>,
    pub soap_draft_job: Option<SessionJobStatus>,
    pub soap_note: Option<SessionSoapNote>,
    pub whisper_ready: bool,
    pub ollama_ready: bool,
}

fn latest_session_job(
    conn: &rusqlite::Connection,
    session_id: &str,
    job_type: &str,
) -> Result<Option<SessionJobStatus>, String> {
    // Prefer json_extract when available; fall back to LIKE on the session id
    // so older SQLite builds without JSON1 still work in tests.
    let mut stmt = conn
        .prepare(
            r#"
            SELECT id, job_type, status, progress, error, created_at, started_at, completed_at
            FROM jobs
            WHERE job_type = ?1
              AND (
                json_extract(payload, '$.sessionId') = ?2
                OR payload LIKE '%' || ?2 || '%'
              )
            ORDER BY created_at DESC
            LIMIT 1
            "#,
        )
        .map_err(|e| e.to_string())?;

    let row = stmt
        .query_row(rusqlite::params![job_type, session_id], |row| {
            Ok(SessionJobStatus {
                id: row.get(0)?,
                job_type: row.get(1)?,
                status: row.get(2)?,
                progress: row.get(3)?,
                error: row.get(4)?,
                created_at: row.get(5)?,
                started_at: row.get(6)?,
                completed_at: row.get(7)?,
            })
        })
        .optional()
        .map_err(|e| e.to_string())?;

    Ok(row)
}

fn query_session_pipeline(
    conn: &rusqlite::Connection,
    session_id: &str,
) -> Result<SessionPipelineStatus, String> {
    let recording_path: Option<String> = conn
        .query_row(
            r#"
            SELECT file_path FROM recordings
            WHERE session_id = ?1
            ORDER BY created_at DESC
            LIMIT 1
            "#,
            [session_id],
            |r| r.get(0),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let has_transcript: bool = conn
        .query_row(
            "SELECT EXISTS(SELECT 1 FROM transcripts WHERE session_id = ?1)",
            [session_id],
            |r| r.get::<_, i64>(0),
        )
        .map(|n| n != 0)
        .map_err(|e| e.to_string())?;

    let soap_note = conn
        .query_row(
            r#"
            SELECT id, subjective, objective, assessment, plan, is_draft
            FROM soap_notes
            WHERE session_id = ?1
            ORDER BY updated_at DESC
            LIMIT 1
            "#,
            [session_id],
            |row| {
                Ok(SessionSoapNote {
                    id: Some(row.get(0)?),
                    subjective: row.get(1)?,
                    objective: row.get(2)?,
                    assessment: row.get(3)?,
                    plan: row.get(4)?,
                    is_draft: row.get::<_, i64>(5)? != 0,
                })
            },
        )
        .optional()
        .map_err(|e| e.to_string())?;

    // Ollama readiness is "paths configured / model chosen"; live probe is
    // expensive for a 2s poll — UI can still show job failures if Ollama is down.
    let ollama_ready = read_setting(conn, "ollama_model").is_some()
        || read_setting(conn, "ollama_model_name").is_some();

    Ok(SessionPipelineStatus {
        session_id: session_id.to_string(),
        has_recording: recording_path.is_some(),
        recording_path,
        has_transcript,
        transcription_job: latest_session_job(conn, session_id, "transcription")?,
        soap_draft_job: latest_session_job(conn, session_id, "soap_draft")?,
        soap_note,
        // Filled by the Tauri command with AppHandle (disk + settings heal).
        whisper_ready: false,
        ollama_ready,
    })
}

/// Pollable status for one session's local transcription → SOAP draft pipeline.
#[tauri::command]
pub async fn get_session_pipeline_status(
    app: AppHandle,
    session_id: String,
) -> Result<SessionPipelineStatus, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    let mut status = query_session_pipeline(&conn, &session_id)?;
    let get_setting = |key: &str| -> Option<String> { read_setting(&conn, key) };
    status.whisper_ready = crate::ml_setup::resolve_whisper_paths(&app, &get_setting).is_ok();
    Ok(status)
}

/// Render a session's finalized SOAP note to a PDF on local disk and return
/// its path. Refuses to export a draft -- a draft SOAP note is not yet
/// something the therapist has reviewed/signed off on for the record.
#[tauri::command]
pub async fn export_soap_pdf(app: AppHandle, session_id: String) -> Result<String, String> {
    let full = get_full_session(app.clone(), session_id.clone())
        .await?
        .ok_or_else(|| format!("Session {} not found", session_id))?;

    let soap_note = full
        .soap_note
        .ok_or_else(|| "This session has no SOAP note to export".to_string())?;

    if soap_note.is_draft {
        return Err("Cannot export a draft SOAP note -- finalize it first".to_string());
    }

    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    let (signed_at, signed_by, session_date): (Option<String>, Option<String>, String) = conn
        .query_row(
            r#"
            SELECT sn.signed_at, sn.signed_by, COALESCE(s.started_at, s.created_at)
            FROM soap_notes sn
            JOIN sessions s ON s.id = sn.session_id
            WHERE sn.session_id = ?1
            ORDER BY sn.updated_at DESC
            LIMIT 1
            "#,
            [&session_id],
            |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
        )
        .map_err(|e| e.to_string())?;

    let pdf_data = SoapPdfData {
        client_name: format!("{} {}", full.client.first_name, full.client.last_name),
        session_id: session_id.clone(),
        session_date,
        subjective: soap_note.subjective,
        objective: soap_note.objective,
        assessment: soap_note.assessment,
        plan: soap_note.plan,
        signed_at,
        signed_by,
    };

    let export_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("exports");
    std::fs::create_dir_all(&export_dir).map_err(|e| e.to_string())?;

    let file_name = format!("soap_note_{}.pdf", session_id);
    let output_path = export_dir.join(&file_name);

    generate_soap_pdf(&pdf_data, &output_path)?;

    Ok(output_path.to_string_lossy().to_string())
}

/// Open a previously exported PDF with the OS's default viewer. Purely a
/// local filesystem/OS handoff (`tauri_plugin_shell`'s open) -- no network
/// call of any kind, and the only path ever passed in here is one this app
/// just wrote to its own app-data directory.
#[tauri::command]
pub async fn open_superbill_pdf(app: AppHandle, path: String) -> Result<(), String> {
    app.shell()
        .open(path, None)
        .map_err(|e| format!("Failed to open PDF: {}", e))
}

/// Ops-only pending superbill requests from the web portal (status + invoice metadata).
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct SuperbillRequestItem {
    pub invoice_id: String,
    pub client_id: String,
    pub client_first_name: String,
    pub client_last_name: String,
    pub client_email: String,
    pub amount_cents: i64,
    pub description: String,
    pub paid_at: Option<String>,
    pub superbill_request_status: String,
    pub superbill_requested_at: Option<String>,
}

#[derive(Debug, Deserialize)]
struct SuperbillRequestsResponse {
    requests: Vec<SuperbillRequestItem>,
}

async fn fetch_superbill_requests(
    web_api_url: &str,
    api_key: &str,
) -> Result<Vec<SuperbillRequestItem>, String> {
    let client = sync_http_client()?;
    let url = format!(
        "{}/api/desktop/superbill-requests?status=requested",
        web_api_url.trim_end_matches('/')
    );
    let resp = client
        .get(&url)
        .header(DESKTOP_API_KEY_HEADER, api_key)
        .send()
        .await
        .map_err(|e| format!("Couldn't reach superbill requests: {}", e))?;

    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("Desktop API key rejected — check Settings → Desktop connection".to_string());
    }
    if !resp.status().is_success() {
        return Err(format!(
            "Superbill requests returned HTTP {}",
            resp.status()
        ));
    }

    let body: SuperbillRequestsResponse = resp
        .json()
        .await
        .map_err(|e| format!("Couldn't parse superbill requests: {}", e))?;
    Ok(body.requests)
}

#[tauri::command]
pub async fn get_pending_superbill_requests(
    app: AppHandle,
) -> Result<Vec<SuperbillRequestItem>, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    let web_api_url = read_setting(&conn, "web_api_url").unwrap_or_default();
    let api_key = read_setting(&conn, "desktop_api_key").unwrap_or_default();
    if web_api_url.trim().is_empty() || api_key.trim().is_empty() {
        return Err(
            "Connect to the web portal in Settings before loading superbill requests".to_string(),
        );
    }
    fetch_superbill_requests(&web_api_url, &api_key).await
}

async fn post_mark_superbill_sent(
    web_api_url: &str,
    api_key: &str,
    invoice_id: &str,
) -> Result<(), String> {
    let client = sync_http_client()?;
    let url = format!(
        "{}/api/desktop/superbill-requests",
        web_api_url.trim_end_matches('/')
    );
    let resp = client
        .post(&url)
        .header(DESKTOP_API_KEY_HEADER, api_key)
        .json(&serde_json::json!({
            "invoiceId": invoice_id,
            "action": "mark_sent"
        }))
        .send()
        .await
        .map_err(|e| format!("Couldn't mark superbill sent: {}", e))?;

    if resp.status() == reqwest::StatusCode::UNAUTHORIZED {
        return Err("Desktop API key rejected — check Settings → Desktop connection".to_string());
    }
    if !resp.status().is_success() {
        let status = resp.status();
        let body = resp.text().await.unwrap_or_default();
        return Err(format!(
            "Mark sent failed (HTTP {}): {}",
            status,
            body.chars().take(200).collect::<String>()
        ));
    }
    Ok(())
}

/// Mark a web invoice's superbill request as sent after local PDF share.
/// Never uploads PDF bytes — status timestamp only.
#[tauri::command]
pub async fn mark_superbill_request_sent(
    app: AppHandle,
    invoice_id: String,
) -> Result<(), String> {
    if invoice_id.trim().is_empty() {
        return Err("invoiceId is required".to_string());
    }
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    let web_api_url = read_setting(&conn, "web_api_url").unwrap_or_default();
    let api_key = read_setting(&conn, "desktop_api_key").unwrap_or_default();
    if web_api_url.trim().is_empty() || api_key.trim().is_empty() {
        return Err(
            "Connect to the web portal in Settings before marking a superbill sent".to_string(),
        );
    }
    post_mark_superbill_sent(&web_api_url, &api_key, &invoice_id).await
}

// ---------------------------------------------------------------------------
// Recording capture
//
// Writes locally-captured microphone audio (as raw bytes handed over from
// the frontend's MediaRecorder Blob) to $APPDATA/recordings and records its
// metadata in the local recordings table. No network call of any kind --
// pure local file write + local SQLite insert.
// ---------------------------------------------------------------------------

fn insert_recording_record(
    conn: &rusqlite::Connection,
    session_id: &str,
    file_path: &str,
    format: &str,
    size_bytes: i64,
) -> Result<String, String> {
    let recording_id = uuid::Uuid::new_v4().to_string();
    conn.execute(
        r#"
        INSERT INTO recordings (id, session_id, file_path, format, size_bytes)
        VALUES (?1, ?2, ?3, ?4, ?5)
        "#,
        rusqlite::params![&recording_id, session_id, file_path, format, size_bytes],
    )
    .map_err(|e| e.to_string())?;
    conn.execute(
        "UPDATE sessions SET recording_id = ?1 WHERE id = ?2",
        rusqlite::params![&recording_id, session_id],
    )
    .map_err(|e| e.to_string())?;
    Ok(recording_id)
}

/// Writes captured audio bytes (handed over from the frontend's
/// MediaRecorder Blob) to `$APPDATA/recordings/<session_id>.<format>` and
/// records the recording's metadata in the local recordings table, linked
/// to the given session. When `enqueue_transcription` is true (default),
/// also enqueues a local transcription job (whisper if configured;
/// otherwise the job fails and the therapist can enter notes manually).
/// Returns the absolute file path written.
#[tauri::command]
pub async fn save_recording_file(
    app: AppHandle,
    session_id: String,
    audio_bytes: Vec<u8>,
    format: String,
    enqueue_transcription: Option<bool>,
) -> Result<String, String> {
    let recordings_dir = app
        .path()
        .app_data_dir()
        .map_err(|e| e.to_string())?
        .join("recordings");
    std::fs::create_dir_all(&recordings_dir).map_err(|e| e.to_string())?;

    let file_name = format!("{}.{}", session_id, format);
    let file_path = recordings_dir.join(&file_name);
    std::fs::write(&file_path, &audio_bytes).map_err(|e| e.to_string())?;

    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    let path_str = file_path.to_string_lossy().to_string();
    let recording_id = insert_recording_record(
        &conn,
        &session_id,
        &path_str,
        &format,
        audio_bytes.len() as i64,
    )?;

    if enqueue_transcription.unwrap_or(true) {
        let payload = serde_json::json!({
            "sessionId": session_id,
            "recordingId": recording_id,
            "audioPath": path_str,
        })
        .to_string();
        enqueue_job(&conn, "transcription", &payload)?;
    }

    Ok(path_str)
}

/// Copy already-captured audio bytes to a therapist-chosen path (Save dialog).
/// Used by the post-Stop "Save the audio file" action. Does not touch the
/// clinical DB — `save_recording_file` already persisted the session copy.
#[tauri::command]
pub async fn export_audio_bytes(dest_path: String, audio_bytes: Vec<u8>) -> Result<(), String> {
    if let Some(parent) = std::path::Path::new(&dest_path).parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    std::fs::write(&dest_path, &audio_bytes).map_err(|e| e.to_string())
}

#[cfg(test)]
mod sync_tests {
    use super::*;
    use rusqlite::Connection;
    use std::io::{Read, Write};
    use std::net::TcpListener;

    /// Minimal stdlib-only local HTTP test server: binds 127.0.0.1:0 (OS
    /// picks a free port), serves exactly one request with a fixed JSON
    /// body and status, then shuts down. No new crate dependency (no
    /// wiremock/httpmock in Cargo.toml) -- this exists so sync_clients'
    /// real reqwest GET can be exercised against a real socket instead of
    /// mocking reqwest itself, which is exactly the kind of integration bug
    /// (wrong path, wrong header name, wrong JSON shape) a mocked-away test
    /// would hide. Returns the base URL to hit and a JoinHandle to await.
    fn spawn_test_server(
        status_line: &'static str,
        body: &'static str,
        expect_header: Option<(&'static str, &'static str)>,
    ) -> (String, std::thread::JoinHandle<bool>) {
        let listener = TcpListener::bind("127.0.0.1:0").unwrap();
        let port = listener.local_addr().unwrap().port();
        let url = format!("http://127.0.0.1:{}", port);

        let handle = std::thread::spawn(move || {
            let (mut stream, _) = listener.accept().unwrap();
            let mut buf = [0u8; 4096];
            let n = stream.read(&mut buf).unwrap_or(0);
            let request_text = String::from_utf8_lossy(&buf[..n]);

            let header_ok = match expect_header {
                Some((name, value)) => request_text
                    .lines()
                    .any(|l| l.eq_ignore_ascii_case(&format!("{}: {}", name, value))),
                None => true,
            };

            let response = format!(
                "{}\r\nContent-Type: application/json\r\nContent-Length: {}\r\n\r\n{}",
                status_line,
                body.len(),
                body
            );
            let _ = stream.write_all(response.as_bytes());
            let _ = stream.flush();
            header_ok
        });

        (url, handle)
    }

    fn test_conn_with_clients_table() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE clients (
                id TEXT PRIMARY KEY,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT,
                all_consents_signed INTEGER NOT NULL DEFAULT 0,
                recording_consent_signed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            "#,
        )
        .unwrap();
        conn
    }

    fn test_conn_with_settings_table() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            "#,
        )
        .unwrap();
        conn
    }

    // -- save_settings / persist_settings --------------------------------

    #[test]
    fn real_sql_persist_settings_writes_all_fields_into_settings_table() {
        let conn = test_conn_with_settings_table();
        let settings = Settings {
            web_api_url: "https://app.solopractice.io".to_string(),
            api_key: Some("sp_desktop_abc123".to_string()),
            whisper_model_size: "base".to_string(),
            ollama_model: "llama3.2".to_string(),
            auto_backup: true,
            backup_path: "/tmp/backup".to_string(),
        };
        persist_settings(&conn, &settings).unwrap();

        assert_eq!(read_setting(&conn, "web_api_url").unwrap(), "https://app.solopractice.io");
        assert_eq!(read_setting(&conn, "desktop_api_key").unwrap(), "sp_desktop_abc123");
        assert_eq!(read_setting(&conn, "whisper_model_size").unwrap(), "base");
        assert_eq!(read_setting(&conn, "ollama_model").unwrap(), "llama3.2");
        assert_eq!(read_setting(&conn, "auto_backup").unwrap(), "true");
        assert_eq!(read_setting(&conn, "backup_path").unwrap(), "/tmp/backup");
    }

    #[test]
    fn real_sql_read_settings_round_trips_persisted_values() {
        // Regression test: Settings.tsx used to never call get_settings at
        // all, so every page remount silently reset the UI back to
        // hardcoded defaults even though persist_settings had already
        // written the real values -- this would have made a saved webApiUrl
        // or apiKey look like it "didn't save" on the next visit, and a
        // second Save click would have overwritten the real saved key with
        // the stale default. This test proves the full round trip works,
        // not just that persist_settings writes rows.
        let conn = test_conn_with_settings_table();
        let original = Settings {
            web_api_url: "https://app.solopractice.io".to_string(),
            api_key: Some("sp_desktop_roundtrip".to_string()),
            whisper_model_size: "small".to_string(),
            ollama_model: "llama3.2".to_string(),
            auto_backup: false,
            backup_path: "/tmp/backup2".to_string(),
        };
        persist_settings(&conn, &original).unwrap();

        let loaded = read_settings(&conn);
        assert_eq!(loaded.web_api_url, original.web_api_url);
        assert_eq!(loaded.api_key, original.api_key);
        assert_eq!(loaded.whisper_model_size, original.whisper_model_size);
        assert_eq!(loaded.ollama_model, original.ollama_model);
        assert_eq!(loaded.auto_backup, original.auto_backup);
        assert_eq!(loaded.backup_path, original.backup_path);
    }

    #[test]
    fn real_sql_read_settings_defaults_to_production_url_when_nothing_saved() {
        // A fresh install (or a settings table that predates this field)
        // must never default to a localhost dev URL -- a real trial user
        // has no reason to know about port 3847, and defaulting there
        // silently breaks Sync Now with a confusing "couldn't reach"
        // error that looks like a bug rather than a config issue.
        let conn = test_conn_with_settings_table();
        let loaded = read_settings(&conn);
        assert_eq!(loaded.web_api_url, "https://www.solopractice.io");
        assert_eq!(loaded.api_key, None);
    }

    #[test]
    fn real_sql_persist_settings_updates_not_duplicates() {
        let conn = test_conn_with_settings_table();
        let mut settings = Settings {
            web_api_url: "https://first.example.com".to_string(),
            api_key: Some("sp_desktop_first".to_string()),
            whisper_model_size: "base".to_string(),
            ollama_model: "llama3.2".to_string(),
            auto_backup: false,
            backup_path: "".to_string(),
        };
        persist_settings(&conn, &settings).unwrap();
        settings.web_api_url = "https://second.example.com".to_string();
        settings.api_key = Some("sp_desktop_second".to_string());
        persist_settings(&conn, &settings).unwrap();

        assert_eq!(read_setting(&conn, "web_api_url").unwrap(), "https://second.example.com");
        assert_eq!(read_setting(&conn, "desktop_api_key").unwrap(), "sp_desktop_second");

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM settings WHERE key = 'web_api_url'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1, "second save must UPDATE, not INSERT a duplicate row");
    }

    #[test]
    fn real_sql_persist_settings_leaves_api_key_unset_when_none() {
        let conn = test_conn_with_settings_table();
        let settings = Settings {
            web_api_url: "https://app.solopractice.io".to_string(),
            api_key: None,
            whisper_model_size: "base".to_string(),
            ollama_model: "llama3.2".to_string(),
            auto_backup: true,
            backup_path: "".to_string(),
        };
        persist_settings(&conn, &settings).unwrap();
        assert!(read_setting(&conn, "desktop_api_key").is_none());
    }

    #[test]
    fn real_sql_read_setting_returns_none_for_missing_key() {
        let conn = test_conn_with_settings_table();
        assert!(read_setting(&conn, "does_not_exist").is_none());
    }

    // -- upsert_synced_client ---------------------------------------------

    fn sample_sync_client(id: &str) -> SyncClient {
        SyncClient {
            id: id.to_string(),
            first_name: "Ada".to_string(),
            last_name: "Lovelace".to_string(),
            email: "ada@example.com".to_string(),
            phone: Some("+15551234567".to_string()),
            all_consents_signed: true,
            recording_consent_signed: true,
        }
    }

    #[test]
    fn real_sql_upsert_synced_client_inserts_new_row() {
        let conn = test_conn_with_clients_table();
        upsert_synced_client(&conn, &sample_sync_client("web-client-1")).unwrap();

        let (first_name, all_signed): (String, i64) = conn
            .query_row(
                "SELECT first_name, all_consents_signed FROM clients WHERE id = ?1",
                ["web-client-1"],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(first_name, "Ada");
        assert_eq!(all_signed, 1);
    }

    #[test]
    fn real_sql_upsert_synced_client_updates_not_duplicates_on_rerun() {
        let conn = test_conn_with_clients_table();
        let mut client = sample_sync_client("web-client-1");
        upsert_synced_client(&conn, &client).unwrap();

        // Re-sync with changed consent + name -- same id (web portal's id,
        // used directly as the local primary key, see upsert_synced_client's
        // doc comment for the id-matching design decision).
        client.all_consents_signed = false;
        client.first_name = "Ada Renamed".to_string();
        upsert_synced_client(&conn, &client).unwrap();

        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM clients WHERE id = 'web-client-1'", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 1, "re-sync of the same web id must UPDATE, not duplicate");

        let (first_name, all_signed): (String, i64) = conn
            .query_row(
                "SELECT first_name, all_consents_signed FROM clients WHERE id = 'web-client-1'",
                [],
                |r| Ok((r.get(0)?, r.get(1)?)),
            )
            .unwrap();
        assert_eq!(first_name, "Ada Renamed");
        assert_eq!(all_signed, 0);
    }

    /// End-to-end proof for scope item 5: a client inserted via the sync
    /// upsert path is indistinguishable, from query_clients' point of view,
    /// from any other row in the real clients table -- i.e. it will show up
    /// in get_clients/ClientList.tsx with no separate code path needed.
    #[test]
    fn real_sql_synced_client_appears_in_get_clients_query() {
        let conn = test_conn_with_clients_table();
        upsert_synced_client(&conn, &sample_sync_client("web-client-42")).unwrap();

        let clients = query_clients(&conn).unwrap();
        assert_eq!(clients.len(), 1);
        assert_eq!(clients[0].id, "web-client-42");
        assert_eq!(clients[0].first_name, "Ada");
        assert!(clients[0].all_consents_signed);
    }

    // -- fetch_sync_clients: real HTTP against a real local test server ---

    #[test]
    fn real_http_fetch_sync_clients_parses_real_response_from_local_server() {
        let body = r#"{
            "therapist": {"id": "t1", "firstName": "Jo", "lastName": "Smith", "email": "jo@example.com", "practiceName": null, "credentials": null},
            "clients": [
                {
                    "id": "web-client-1",
                    "firstName": "Ada",
                    "lastName": "Lovelace",
                    "email": "ada@example.com",
                    "phone": "+15551234567",
                    "allConsentsSigned": true,
                    "recordingConsentSigned": true,
                    "consentsSigned": 5,
                    "consentsRequired": 5,
                    "consents": []
                }
            ],
            "syncedAt": "2026-01-01T00:00:00.000Z"
        }"#;
        let (url, handle) = spawn_test_server(
            "HTTP/1.1 200 OK",
            body,
            Some(("X-Desktop-API-Key", "sp_desktop_test123")),
        );

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(fetch_sync_clients(&url, "sp_desktop_test123"));
        let header_was_sent = handle.join().unwrap();

        assert!(header_was_sent, "request must carry X-Desktop-API-Key header");
        let clients = result.expect("expected Ok from a real 200 response");
        assert_eq!(clients.len(), 1);
        assert_eq!(clients[0].id, "web-client-1");
        assert_eq!(clients[0].first_name, "Ada");
        assert!(clients[0].all_consents_signed);
    }

    #[test]
    fn real_http_fetch_sync_clients_surfaces_clear_error_on_401() {
        let (url, handle) = spawn_test_server(
            "HTTP/1.1 401 Unauthorized",
            r#"{"error":"Invalid or missing API key"}"#,
            None,
        );

        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(fetch_sync_clients(&url, "wrong-key"));
        let _ = handle.join();

        let err = result.expect_err("expected Err from a real 401 response");
        assert!(err.contains("rejected"), "error should explain the key was rejected: {err}");
    }

    #[test]
    fn real_http_fetch_sync_clients_fails_cleanly_when_server_unreachable() {
        // Port 0 connections never succeed; this proves network failures
        // (vs. HTTP error statuses) are also surfaced as a clean Err, not a
        // panic, without needing a real server at all.
        let rt = tokio::runtime::Runtime::new().unwrap();
        let result = rt.block_on(fetch_sync_clients("http://127.0.0.1:1", "any-key"));
        assert!(result.is_err());
    }

    /// Full round trip: real local HTTP server -> fetch_sync_clients ->
    /// upsert_synced_client -> query_clients, using the exact same helpers
    /// sync_clients() the tauri command composes. Proves the whole pipeline
    /// end to end without needing an AppHandle/live web server.
    #[test]
    fn real_sync_pipeline_fetches_and_upserts_into_real_sqlite() {
        let body = r#"{
            "clients": [
                {
                    "id": "web-client-9",
                    "firstName": "Grace",
                    "lastName": "Hopper",
                    "email": "grace@example.com",
                    "phone": null,
                    "allConsentsSigned": false,
                    "recordingConsentSigned": false
                }
            ]
        }"#;
        let (url, _handle) = spawn_test_server("HTTP/1.1 200 OK", body, None);

        let rt = tokio::runtime::Runtime::new().unwrap();
        let clients = rt.block_on(fetch_sync_clients(&url, "sp_desktop_test")).unwrap();

        let conn = test_conn_with_clients_table();
        for client in &clients {
            upsert_synced_client(&conn, client).unwrap();
        }

        let local_clients = query_clients(&conn).unwrap();
        assert_eq!(local_clients.len(), 1);
        assert_eq!(local_clients[0].id, "web-client-9");
        assert_eq!(local_clients[0].last_name, "Hopper");
        assert!(!local_clients[0].all_consents_signed);
    }
}

#[cfg(test)]
mod client_tests {
    use super::*;
    use rusqlite::Connection;

    fn test_conn_with_clients() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE clients (
                id TEXT PRIMARY KEY,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT,
                all_consents_signed INTEGER NOT NULL DEFAULT 0,
                recording_consent_signed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            INSERT INTO clients (id, first_name, last_name, email, phone, all_consents_signed, recording_consent_signed)
            VALUES ('c1', 'Ada', 'Lovelace', 'ada@example.com', NULL, 1, 1);
            INSERT INTO clients (id, first_name, last_name, email, phone, all_consents_signed, recording_consent_signed)
            VALUES ('c2', 'Grace', 'Hopper', 'grace@example.com', '+15551234567', 0, 0);
            "#,
        )
        .unwrap();
        conn
    }

    #[test]
    fn real_sql_lists_clients_from_real_table() {
        // query_clients orders by last_name, first_name (see its SQL) --
        // "Hopper" sorts before "Lovelace" alphabetically, so Grace is
        // row 0 here even though Ada was inserted first.
        let conn = test_conn_with_clients();
        let clients = query_clients(&conn).unwrap();
        assert_eq!(clients.len(), 2);
        assert_eq!(clients[0].first_name, "Grace");
        assert_eq!(clients[0].all_consents_signed, false);
        assert_eq!(clients[0].phone, Some("+15551234567".to_string()));
        assert_eq!(clients[1].first_name, "Ada");
        assert_eq!(clients[1].all_consents_signed, true);
    }

    #[test]
    fn real_sql_get_client_by_id_returns_none_for_missing() {
        let conn = test_conn_with_clients();
        let found = query_client_by_id(&conn, "does-not-exist").unwrap();
        assert!(found.is_none());
    }

    #[test]
    fn real_sql_get_client_by_id_returns_match() {
        let conn = test_conn_with_clients();
        let found = query_client_by_id(&conn, "c2").unwrap();
        assert!(found.is_some());
        assert_eq!(found.unwrap().last_name, "Hopper");
    }

    #[test]
    fn real_sql_insert_client_row_appears_in_query() {
        let conn = test_conn_with_clients();
        let before = query_clients(&conn).unwrap().len();
        conn.execute(
            "INSERT INTO clients (id, first_name, last_name, email, phone, all_consents_signed, recording_consent_signed) VALUES ('c3', 'New', 'Client', 'new@example.com', NULL, 0, 0)",
            [],
        ).unwrap();
        let after = query_clients(&conn).unwrap();
        assert_eq!(after.len(), before + 1);
        assert!(after.iter().any(|c| c.id == "c3" && c.first_name == "New"));
    }
}

#[cfg(test)]
mod job_queue_tests {
    use super::*;
    use rusqlite::Connection;

    fn test_conn_with_jobs() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE jobs (
                id TEXT PRIMARY KEY,
                job_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                progress INTEGER,
                payload TEXT NOT NULL,
                result TEXT,
                error TEXT,
                attempts INTEGER NOT NULL DEFAULT 0,
                max_attempts INTEGER NOT NULL DEFAULT 3,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                started_at TEXT,
                completed_at TEXT
            );
            INSERT INTO jobs (id, job_type, status, progress, payload, created_at)
            VALUES ('job-1', 'transcription', 'in_progress', 45, '{}', '2026-01-01T10:01:00Z');
            INSERT INTO jobs (id, job_type, status, payload, created_at)
            VALUES ('job-2', 'soap_draft', 'pending', '{}', '2026-01-01T10:03:00Z');
            INSERT INTO jobs (id, job_type, status, payload, result, completed_at, created_at)
            VALUES ('job-3', 'transcription', 'completed', '{}', '{"content":"hi"}', '2026-01-01T10:03:00Z', '2026-01-01T10:02:00Z');
            "#,
        )
        .unwrap();
        conn
    }

    #[test]
    fn real_sql_job_queue_lists_real_jobs_newest_first() {
        let conn = test_conn_with_jobs();
        let response = query_job_queue(&conn).unwrap();
        assert_eq!(response.jobs.len(), 3);
        // newest created_at first
        assert_eq!(response.jobs[0].id, "job-2");
        assert_eq!(response.jobs[1].id, "job-3");
        assert_eq!(response.jobs[2].id, "job-1");
    }

    #[test]
    fn real_sql_job_queue_computes_real_stats_from_status_counts() {
        let conn = test_conn_with_jobs();
        let response = query_job_queue(&conn).unwrap();
        assert_eq!(response.stats.pending, 1);
        assert_eq!(response.stats.in_progress, 1);
        assert_eq!(response.stats.completed, 1);
        assert_eq!(response.stats.failed, 0);
    }

    #[test]
    fn real_sql_job_queue_surfaces_result_json_for_completed_job() {
        let conn = test_conn_with_jobs();
        let response = query_job_queue(&conn).unwrap();
        let completed = response.jobs.iter().find(|j| j.id == "job-3").unwrap();
        assert_eq!(completed.result, Some("{\"content\":\"hi\"}".to_string()));
    }

    #[test]
    fn real_sql_session_pipeline_finds_jobs_and_soap_for_session() {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE recordings (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                file_path TEXT NOT NULL,
                duration_seconds INTEGER,
                format TEXT NOT NULL DEFAULT 'wav',
                size_bytes INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE transcripts (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                recording_id TEXT NOT NULL,
                content TEXT NOT NULL,
                model_used TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE soap_notes (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL,
                client_id TEXT NOT NULL,
                subjective TEXT NOT NULL DEFAULT '',
                objective TEXT NOT NULL DEFAULT '',
                assessment TEXT NOT NULL DEFAULT '',
                plan TEXT NOT NULL DEFAULT '',
                is_draft INTEGER NOT NULL DEFAULT 1,
                updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE jobs (
                id TEXT PRIMARY KEY,
                job_type TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                progress INTEGER,
                payload TEXT NOT NULL,
                result TEXT,
                error TEXT,
                attempts INTEGER NOT NULL DEFAULT 0,
                max_attempts INTEGER NOT NULL DEFAULT 3,
                created_at TEXT NOT NULL DEFAULT (datetime('now')),
                started_at TEXT,
                completed_at TEXT
            );
            INSERT INTO recordings (id, session_id, file_path)
            VALUES ('r1', 'sess-A', '/tmp/sess-A.wav');
            INSERT INTO jobs (id, job_type, status, progress, payload, created_at)
            VALUES (
              'j-tx', 'transcription', 'in_progress', 20,
              '{"sessionId":"sess-A","recordingId":"r1","audioPath":"/tmp/sess-A.wav"}',
              '2026-01-01T10:00:00Z'
            );
            INSERT INTO jobs (id, job_type, status, payload, created_at)
            VALUES (
              'j-other', 'transcription', 'completed',
              '{"sessionId":"sess-B","recordingId":"r2","audioPath":"/tmp/sess-B.wav"}',
              '2026-01-01T10:05:00Z'
            );
            INSERT INTO soap_notes (id, session_id, client_id, subjective, is_draft)
            VALUES ('n1', 'sess-A', 'c1', 'Client reports stress', 1);
            "#,
        )
        .unwrap();

        let status = query_session_pipeline(&conn, "sess-A").unwrap();
        assert!(status.has_recording);
        assert_eq!(status.recording_path.as_deref(), Some("/tmp/sess-A.wav"));
        assert!(!status.has_transcript);
        assert_eq!(status.transcription_job.as_ref().map(|j| j.id.as_str()), Some("j-tx"));
        assert_eq!(
            status.transcription_job.as_ref().map(|j| j.status.as_str()),
            Some("in_progress")
        );
        assert!(status.soap_draft_job.is_none());
        assert_eq!(
            status.soap_note.as_ref().map(|n| n.subjective.as_str()),
            Some("Client reports stress")
        );
    }
}

#[cfg(test)]
mod session_lifecycle_tests {
    use super::*;
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE clients (id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, email TEXT, phone TEXT, all_consents_signed INTEGER DEFAULT 0, recording_consent_signed INTEGER DEFAULT 0);
            CREATE TABLE sessions (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled', started_at TEXT, ended_at TEXT, recording_id TEXT, transcript_id TEXT, soap_note_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
            CREATE TABLE soap_notes (id TEXT PRIMARY KEY, session_id TEXT NOT NULL, client_id TEXT NOT NULL, subjective TEXT, objective TEXT, assessment TEXT, plan TEXT, diagnosis_codes TEXT, procedure_codes TEXT, is_draft INTEGER NOT NULL DEFAULT 1, signed_at TEXT, signed_by TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now')));
            INSERT INTO clients (id, first_name, last_name, email) VALUES ('c1', 'Ada', 'Lovelace', 'ada@example.com');
            "#,
        ).unwrap();
        conn
    }

    #[test]
    fn real_sql_create_session_for_client() {
        let conn = test_conn();
        // Default seed client has recording_consent_signed = 0; allow record for this path.
        conn.execute(
            "UPDATE clients SET recording_consent_signed = 1 WHERE id = 'c1'",
            [],
        )
        .unwrap();
        let session_id = insert_new_session(&conn, "c1").unwrap();
        let status: String = conn.query_row(
            "SELECT status FROM sessions WHERE id = ?1", [&session_id], |r| r.get(0)
        ).unwrap();
        assert_eq!(status, "in_progress");
    }

    #[test]
    fn real_sql_insert_new_session_rejects_unsigned_recording_consent() {
        let conn = test_conn();
        let err = insert_new_session(&conn, "c1").unwrap_err();
        assert!(
            err.to_lowercase().contains("recording"),
            "expected recording-consent error, got: {err}"
        );
        let count: i64 = conn
            .query_row("SELECT COUNT(*) FROM sessions", [], |r| r.get(0))
            .unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn real_sql_save_soap_note_links_to_session_not_just_client() {
        let conn = test_conn();
        conn.execute(
            "UPDATE clients SET recording_consent_signed = 1 WHERE id = 'c1'",
            [],
        )
        .unwrap();
        let session_id = insert_new_session(&conn, "c1").unwrap();
        let note_id = upsert_soap_note(&conn, &session_id, "c1", "S", "O", "A", "P", false).unwrap();

        let (linked_session, is_draft, signed_at): (String, i64, Option<String>) = conn.query_row(
            "SELECT session_id, is_draft, signed_at FROM soap_notes WHERE id = ?1", [&note_id], |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?))
        ).unwrap();
        assert_eq!(linked_session, session_id);
        assert_eq!(is_draft, 0);
        assert!(signed_at.is_some(), "finalized notes should stamp signed_at");
    }

    #[test]
    fn real_sql_upsert_soap_note_updates_not_duplicates() {
        let conn = test_conn();
        conn.execute(
            "UPDATE clients SET recording_consent_signed = 1 WHERE id = 'c1'",
            [],
        )
        .unwrap();
        let session_id = insert_new_session(&conn, "c1").unwrap();
        let first_id = upsert_soap_note(&conn, &session_id, "c1", "S1", "O1", "A1", "P1", true).unwrap();
        let second_id = upsert_soap_note(&conn, &session_id, "c1", "S2", "O2", "A2", "P2", false).unwrap();
        assert_eq!(first_id, second_id, "second save for the same session must UPDATE, not INSERT a duplicate row");

        let count: i64 = conn.query_row(
            "SELECT COUNT(*) FROM soap_notes WHERE session_id = ?1", [&session_id], |r| r.get(0)
        ).unwrap();
        assert_eq!(count, 1);
    }
}

#[cfg(test)]
mod recording_file_tests {
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE clients (id TEXT PRIMARY KEY, first_name TEXT, last_name TEXT, email TEXT, phone TEXT, all_consents_signed INTEGER DEFAULT 0, recording_consent_signed INTEGER DEFAULT 0);
            CREATE TABLE sessions (id TEXT PRIMARY KEY, client_id TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'scheduled', started_at TEXT, ended_at TEXT, recording_id TEXT, transcript_id TEXT, soap_note_id TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')));
            CREATE TABLE recordings (
                id TEXT PRIMARY KEY,
                session_id TEXT NOT NULL REFERENCES sessions(id),
                file_path TEXT NOT NULL,
                duration_seconds INTEGER,
                format TEXT NOT NULL DEFAULT 'wav',
                size_bytes INTEGER,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            INSERT INTO clients (id, first_name, last_name, email) VALUES ('c1', 'Ada', 'Lovelace', 'ada@example.com');
            INSERT INTO sessions (id, client_id, status, started_at) VALUES ('s1', 'c1', 'in_progress', datetime('now'));
            "#,
        )
        .unwrap();
        conn
    }

    /// Exercises the SAME insert_recording_record() helper that
    /// save_recording_file() calls after writing bytes to disk -- proves
    /// the session_id linkage + size_bytes land right in a real recordings
    /// row, without needing a real AppHandle/filesystem for the command
    /// wrapper itself.
    #[test]
    fn real_sql_insert_recording_links_session_and_records_size() {
        let conn = test_conn();
        let session_id = "s1".to_string();
        let file_path = "/tmp/fake/recordings/s1.wav".to_string();
        let format = "wav".to_string();
        let audio_len: i64 = 4096;

        let recording_id =
            super::insert_recording_record(&conn, &session_id, &file_path, &format, audio_len)
                .unwrap();

        let (linked_session, got_format, got_size): (String, String, i64) = conn
            .query_row(
                "SELECT session_id, format, size_bytes FROM recordings WHERE id = ?1",
                [&recording_id],
                |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
            )
            .unwrap();

        assert_eq!(linked_session, session_id);
        assert_eq!(got_format, "wav");
        assert_eq!(got_size, 4096);
    }
}

#[cfg(test)]
mod session_history_tests {
    use rusqlite::Connection;

    fn seed_db() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE clients (
                id TEXT PRIMARY KEY, first_name TEXT NOT NULL, last_name TEXT NOT NULL,
                email TEXT NOT NULL, phone TEXT, all_consents_signed INTEGER NOT NULL DEFAULT 0,
                recording_consent_signed INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE sessions (
                id TEXT PRIMARY KEY, client_id TEXT NOT NULL REFERENCES clients(id),
                status TEXT NOT NULL DEFAULT 'scheduled', started_at TEXT, ended_at TEXT,
                recording_id TEXT, transcript_id TEXT, soap_note_id TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE recordings (
                id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
                file_path TEXT NOT NULL, duration_seconds INTEGER, format TEXT NOT NULL DEFAULT 'wav',
                size_bytes INTEGER, created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE transcripts (
                id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
                recording_id TEXT NOT NULL REFERENCES recordings(id), content TEXT NOT NULL,
                model_used TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            CREATE TABLE soap_notes (
                id TEXT PRIMARY KEY, session_id TEXT NOT NULL REFERENCES sessions(id),
                client_id TEXT NOT NULL REFERENCES clients(id), subjective TEXT NOT NULL,
                objective TEXT NOT NULL, assessment TEXT NOT NULL, plan TEXT NOT NULL,
                diagnosis_codes TEXT, procedure_codes TEXT, is_draft INTEGER NOT NULL DEFAULT 1,
                signed_at TEXT, signed_by TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now')), updated_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            "#,
        )
        .unwrap();

        conn.execute(
            "INSERT INTO clients (id, first_name, last_name, email) VALUES ('c1', 'Jane', 'Doe', 'jane@example.com')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO sessions (id, client_id, status, created_at) VALUES ('s1', 'c1', 'completed', '2026-01-01T10:00:00Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO sessions (id, client_id, status, created_at) VALUES ('s2', 'c1', 'completed', '2026-01-08T10:00:00Z')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO recordings (id, session_id, file_path) VALUES ('r1', 's1', '/tmp/r1.wav')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO transcripts (id, session_id, recording_id, content, model_used) VALUES ('t1', 's1', 'r1', 'Client discussed anxiety about work.', 'whisper-base.en')",
            [],
        )
        .unwrap();
        conn.execute(
            "INSERT INTO soap_notes (id, session_id, client_id, subjective, objective, assessment, plan, is_draft, signed_at, signed_by) \
             VALUES ('sn1', 's1', 'c1', 'Reports anxiety', 'Alert, oriented', 'Adjustment disorder', 'Continue weekly sessions', 0, '2026-01-01T11:00:00Z', 'Dr. Smith')",
            [],
        )
        .unwrap();

        conn
    }

    /// Mirrors get_client_sessions' query against a real (in-memory) SQLite
    /// schema identical to db.rs, proving the SQL is correct against real
    /// tables/columns -- not mocked data.
    #[test]
    fn real_sql_lists_sessions_newest_first_with_flags() {
        let conn = seed_db();
        let mut stmt = conn
            .prepare(
                r#"
                SELECT s.id, s.client_id, s.status,
                    EXISTS(SELECT 1 FROM recordings r WHERE r.session_id = s.id),
                    EXISTS(SELECT 1 FROM transcripts t WHERE t.session_id = s.id),
                    sn.id IS NOT NULL,
                    sn.is_draft
                FROM sessions s
                LEFT JOIN soap_notes sn ON sn.session_id = s.id
                WHERE s.client_id = ?1
                ORDER BY s.created_at DESC
                "#,
            )
            .unwrap();

        let rows: Vec<(String, bool, bool, bool, Option<i64>)> = stmt
            .query_map(["c1"], |row| {
                Ok((
                    row.get::<_, String>(0)?,
                    row.get::<_, i64>(3)? != 0,
                    row.get::<_, i64>(4)? != 0,
                    row.get::<_, i64>(5)? != 0,
                    row.get(6)?,
                ))
            })
            .unwrap()
            .collect::<Result<_, _>>()
            .unwrap();

        assert_eq!(rows.len(), 2);
        assert_eq!(rows[0].0, "s2"); // newest first
        assert!(!rows[0].1 && !rows[0].2 && !rows[0].3); // s2 has nothing yet
        assert_eq!(rows[1].0, "s1");
        assert!(rows[1].1 && rows[1].2 && rows[1].3); // s1 has recording+transcript+soap
        assert_eq!(rows[1].4, Some(0)); // finalized, not draft
    }

    #[test]
    fn real_sql_full_session_joins_transcript_and_soap() {
        let conn = seed_db();
        let (id, client_id, _status, _hr, _ht, cfirst, clast, cemail): (
            String,
            String,
            String,
            i64,
            i64,
            String,
            String,
            String,
        ) = conn
            .query_row(
                r#"
                SELECT s.id, s.client_id, s.status,
                    EXISTS(SELECT 1 FROM recordings r WHERE r.session_id = s.id),
                    EXISTS(SELECT 1 FROM transcripts t WHERE t.session_id = s.id),
                    c.first_name, c.last_name, c.email
                FROM sessions s JOIN clients c ON c.id = s.client_id
                WHERE s.id = 's1'
                "#,
                [],
                |row| {
                    Ok((
                        row.get(0)?,
                        row.get(1)?,
                        row.get(2)?,
                        row.get(3)?,
                        row.get(4)?,
                        row.get(5)?,
                        row.get(6)?,
                        row.get(7)?,
                    ))
                },
            )
            .unwrap();
        assert_eq!(id, "s1");
        assert_eq!(client_id, "c1");
        assert_eq!(cfirst, "Jane");
        assert_eq!(clast, "Doe");
        assert_eq!(cemail, "jane@example.com");

        let content: String = conn
            .query_row(
                "SELECT content FROM transcripts WHERE session_id = 's1' ORDER BY created_at DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(content, "Client discussed anxiety about work.");

        let (subjective, is_draft, signed_by): (String, i64, Option<String>) = conn
            .query_row(
                "SELECT subjective, is_draft, signed_by FROM soap_notes WHERE session_id = 's1' ORDER BY updated_at DESC LIMIT 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();
        assert_eq!(subjective, "Reports anxiety");
        assert_eq!(is_draft, 0);
        assert_eq!(signed_by, Some("Dr. Smith".to_string()));
    }

    #[test]
    fn real_pdf_export_pipeline_renders_from_real_row() {
        use crate::soap_pdf::{generate_soap_pdf, SoapPdfData};
        let conn = seed_db();

        let (subjective, objective, assessment, plan, signed_at, signed_by): (
            String,
            String,
            String,
            String,
            Option<String>,
            Option<String>,
        ) = conn
            .query_row(
                "SELECT subjective, objective, assessment, plan, signed_at, signed_by FROM soap_notes WHERE session_id = 's1'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?, row.get(4)?, row.get(5)?)),
            )
            .unwrap();

        let data = SoapPdfData {
            client_name: "Jane Doe".to_string(),
            session_id: "s1".to_string(),
            session_date: "2026-01-01".to_string(),
            subjective,
            objective,
            assessment,
            plan,
            signed_at,
            signed_by,
        };

        let out = std::env::temp_dir().join("test_real_soap_export.pdf");
        let result = generate_soap_pdf(&data, &out);
        assert!(result.is_ok());
        assert!(out.exists());
        let size = std::fs::metadata(&out).unwrap().len();
        assert!(size > 500, "PDF suspiciously small: {} bytes", size);
        let _ = std::fs::remove_file(&out);
    }
}

#[cfg(test)]
mod superbill_command_tests {
    use rusqlite::Connection;

    fn test_conn() -> Connection {
        let conn = Connection::open_in_memory().unwrap();
        conn.execute_batch(
            r#"
            CREATE TABLE clients (
                id TEXT PRIMARY KEY,
                first_name TEXT NOT NULL,
                last_name TEXT NOT NULL,
                email TEXT NOT NULL,
                phone TEXT,
                all_consents_signed INTEGER NOT NULL DEFAULT 0,
                recording_consent_signed INTEGER NOT NULL DEFAULT 0
            );
            CREATE TABLE superbills (
                id TEXT PRIMARY KEY,
                session_id TEXT,
                client_id TEXT NOT NULL REFERENCES clients(id),
                service_date TEXT NOT NULL,
                diagnosis_codes TEXT NOT NULL,
                procedure_codes TEXT NOT NULL,
                total_amount_cents INTEGER NOT NULL,
                pdf_path TEXT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            );
            INSERT INTO clients (id, first_name, last_name, email)
            VALUES ('c1', 'Ada', 'Lovelace', 'ada@example.com');
            "#,
        )
        .unwrap();
        conn
    }

    #[test]
    fn real_sql_insert_superbill_without_session() {
        let conn = test_conn();
        super::insert_superbill_record(
            &conn,
            "sb1",
            None,
            "c1",
            "01/15/2026",
            r#"[{"code":"F41.1"}]"#,
            r#"[{"cptCode":"90834"}]"#,
            12000,
            "/tmp/superbills/sb1.pdf",
        )
        .unwrap();

        let records = super::query_superbills(&conn).unwrap();
        assert_eq!(records.len(), 1);
        assert_eq!(records[0].id, "sb1");
        assert_eq!(records[0].client_name, "Ada Lovelace");
        assert_eq!(records[0].total_amount_cents, 12000);
        assert_eq!(records[0].pdf_path, "/tmp/superbills/sb1.pdf");
    }
}
