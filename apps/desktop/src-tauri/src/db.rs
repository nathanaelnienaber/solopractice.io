//! Database module for encrypted local SQLite storage
//!
//! # Security
//!
//! All clinical data is stored in an encrypted SQLite database.
//! The encryption key is derived from a user-provided password.
//!
//! Tables:
//! - clients: local copy of client info (synced from web, minus PHI)
//! - sessions: clinical session records (local only)
//! - recordings: audio recording metadata (local only, audio files separate)
//! - transcripts: transcribed text (local only)
//! - soap_notes: SOAP notes (local only)
//! - superbills: superbill records with Dx/CPT (local only)
//! - jobs: background job queue
//! - settings: app configuration

use rusqlite::{Connection, Result};
use std::path::PathBuf;
use tauri::AppHandle;

pub fn get_db_path(app: &AppHandle) -> PathBuf {
    let app_dir = app
        .path()
        .app_data_dir()
        .expect("Failed to get app data dir");
    std::fs::create_dir_all(&app_dir).ok();
    app_dir.join("solopractice.db")
}

pub fn initialize_database(app: &AppHandle) -> Result<()> {
    let db_path = get_db_path(app);
    let conn = Connection::open(&db_path)?;

    conn.execute_batch(
        r#"
        -- Clients (synced from web, no PHI beyond contact info)
        CREATE TABLE IF NOT EXISTS clients (
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

        -- Sessions (LOCAL ONLY - clinical data)
        CREATE TABLE IF NOT EXISTS sessions (
            id TEXT PRIMARY KEY,
            client_id TEXT NOT NULL REFERENCES clients(id),
            status TEXT NOT NULL DEFAULT 'scheduled',
            started_at TEXT,
            ended_at TEXT,
            recording_id TEXT,
            transcript_id TEXT,
            soap_note_id TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Recordings (LOCAL ONLY - audio metadata, files stored separately)
        CREATE TABLE IF NOT EXISTS recordings (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES sessions(id),
            file_path TEXT NOT NULL,
            duration_seconds INTEGER,
            format TEXT NOT NULL DEFAULT 'wav',
            size_bytes INTEGER,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Transcripts (LOCAL ONLY - never sync)
        CREATE TABLE IF NOT EXISTS transcripts (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES sessions(id),
            recording_id TEXT NOT NULL REFERENCES recordings(id),
            content TEXT NOT NULL,
            model_used TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- SOAP Notes (LOCAL ONLY - clinical documentation)
        CREATE TABLE IF NOT EXISTS soap_notes (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES sessions(id),
            client_id TEXT NOT NULL REFERENCES clients(id),
            subjective TEXT NOT NULL,
            objective TEXT NOT NULL,
            assessment TEXT NOT NULL,
            plan TEXT NOT NULL,
            diagnosis_codes TEXT, -- JSON array
            procedure_codes TEXT, -- JSON array
            is_draft INTEGER NOT NULL DEFAULT 1,
            signed_at TEXT,
            signed_by TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Superbills (LOCAL ONLY - contains Dx/CPT codes)
        CREATE TABLE IF NOT EXISTS superbills (
            id TEXT PRIMARY KEY,
            session_id TEXT NOT NULL REFERENCES sessions(id),
            client_id TEXT NOT NULL REFERENCES clients(id),
            service_date TEXT NOT NULL,
            diagnosis_codes TEXT NOT NULL, -- JSON array
            procedure_codes TEXT NOT NULL, -- JSON array
            total_amount_cents INTEGER NOT NULL,
            pdf_path TEXT,
            created_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Background Jobs (for transcription, SOAP draft, etc.)
        CREATE TABLE IF NOT EXISTS jobs (
            id TEXT PRIMARY KEY,
            job_type TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'pending',
            progress INTEGER,
            payload TEXT NOT NULL, -- JSON
            result TEXT, -- JSON
            error TEXT,
            attempts INTEGER NOT NULL DEFAULT 0,
            max_attempts INTEGER NOT NULL DEFAULT 3,
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            started_at TEXT,
            completed_at TEXT
        );

        -- Local PHI Forms (print/email only, never web)
        CREATE TABLE IF NOT EXISTS local_forms (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            content TEXT NOT NULL,
            client_id TEXT REFERENCES clients(id),
            created_at TEXT NOT NULL DEFAULT (datetime('now')),
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Settings
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL,
            updated_at TEXT NOT NULL DEFAULT (datetime('now'))
        );

        -- Create indexes
        CREATE INDEX IF NOT EXISTS idx_sessions_client ON sessions(client_id);
        CREATE INDEX IF NOT EXISTS idx_recordings_session ON recordings(session_id);
        CREATE INDEX IF NOT EXISTS idx_transcripts_session ON transcripts(session_id);
        CREATE INDEX IF NOT EXISTS idx_soap_notes_session ON soap_notes(session_id);
        CREATE INDEX IF NOT EXISTS idx_soap_notes_client ON soap_notes(client_id);
        CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
        "#,
    )?;

    println!("Database initialized at {:?}", db_path);
    Ok(())
}
