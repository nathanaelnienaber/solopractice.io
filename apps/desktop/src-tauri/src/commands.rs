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

#[tauri::command]
pub async fn create_client(
    app: AppHandle,
    first_name: String,
    last_name: String,
    email: String,
    phone: Option<String>,
) -> Result<Client, String> {
    let conn = db::get_connection(&app).map_err(|e| e.to_string())?;
    let id = uuid::Uuid::new_v4().to_string();

    conn.execute(
        r#"
        INSERT INTO clients (id, first_name, last_name, email, phone, all_consents_signed, recording_consent_signed)
        VALUES (?1, ?2, ?3, ?4, ?5, 0, 0)
        "#,
        rusqlite::params![&id, &first_name, &last_name, &email, &phone],
    )
    .map_err(|e| e.to_string())?;

    Ok(Client {
        id,
        first_name,
        last_name,
        email,
        phone,
        all_consents_signed: false,
        recording_consent_signed: false,
    })
}

fn insert_new_session(conn: &rusqlite::Connection, client_id: &str) -> Result<String, String> {
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
            conn.execute(
                r#"
                UPDATE soap_notes
                SET subjective = ?1, objective = ?2, assessment = ?3, plan = ?4,
                    is_draft = ?5, updated_at = datetime('now')
                WHERE id = ?6
                "#,
                rusqlite::params![subjective, objective, assessment, plan, is_draft as i64, id],
            )
            .map_err(|e| e.to_string())?;
            id
        }
        None => {
            let id = uuid::Uuid::new_v4().to_string();
            conn.execute(
                r#"
                INSERT INTO soap_notes (id, session_id, client_id, subjective, objective, assessment, plan, is_draft)
                VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)
                "#,
                rusqlite::params![&id, session_id, client_id, subjective, objective, assessment, plan, is_draft as i64],
            )
            .map_err(|e| e.to_string())?;
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
            SELECT id, job_type, status, progress, created_at, started_at, completed_at, error, result
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
                created_at: row.get(4)?,
                started_at: row.get(5)?,
                completed_at: row.get(6)?,
                error: row.get(7)?,
                result: row.get(8)?,
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
    fn real_sql_create_client_inserts_and_returns_row() {
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
        let session_id = insert_new_session(&conn, "c1").unwrap();
        let status: String = conn.query_row(
            "SELECT status FROM sessions WHERE id = ?1", [&session_id], |r| r.get(0)
        ).unwrap();
        assert_eq!(status, "in_progress");
    }

    #[test]
    fn real_sql_save_soap_note_links_to_session_not_just_client() {
        let conn = test_conn();
        let session_id = insert_new_session(&conn, "c1").unwrap();
        let note_id = upsert_soap_note(&conn, &session_id, "c1", "S", "O", "A", "P", false).unwrap();

        let (linked_session, is_draft): (String, i64) = conn.query_row(
            "SELECT session_id, is_draft FROM soap_notes WHERE id = ?1", [&note_id], |r| Ok((r.get(0)?, r.get(1)?))
        ).unwrap();
        assert_eq!(linked_session, session_id);
        assert_eq!(is_draft, 0);
    }

    #[test]
    fn real_sql_upsert_soap_note_updates_not_duplicates() {
        let conn = test_conn();
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
