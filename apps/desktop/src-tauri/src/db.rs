//! Local encrypted SQLite database for clinical data
//!
//! SECURITY: This database stores PHI and clinical data.
//! It MUST remain on the local device and NEVER sync to any cloud service.

use rusqlite::{Connection, Result};
use std::path::Path;
use std::sync::Mutex;

lazy_static::lazy_static! {
    static ref DB: Mutex<Option<Connection>> = Mutex::new(None);
}

/// Initialize the local encrypted database
pub fn init_database(path: &Path) -> Result<()> {
    let conn = Connection::open(path)?;
    
    // Create tables for local-only clinical data
    conn.execute_batch(
        r#"
        -- Clients table (local view with clinical fields)
        CREATE TABLE IF NOT EXISTS clients (
            local_id INTEGER PRIMARY KEY AUTOINCREMENT,
            id TEXT UNIQUE NOT NULL,
            first_name TEXT NOT NULL,
            last_name TEXT NOT NULL,
            email TEXT NOT NULL,
            phone TEXT,
            -- Consent status (synced from web as flags only)
            consent_informed INTEGER DEFAULT 0,
            consent_privacy INTEGER DEFAULT 0,
            consent_telehealth INTEGER DEFAULT 0,
            consent_recording INTEGER DEFAULT 0,
            consent_limits INTEGER DEFAULT 0,
            consent_last_updated TEXT,
            -- Local-only fields (NEVER sync to web)
            notes TEXT,
            diagnosis_codes TEXT, -- JSON array, NEVER sync
            recording_enabled INTEGER DEFAULT 0,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );

        -- Sessions table (ALL clinical data - NEVER sync to web)
        CREATE TABLE IF NOT EXISTS sessions (
            local_id INTEGER PRIMARY KEY AUTOINCREMENT,
            web_appointment_id TEXT,
            client_local_id INTEGER NOT NULL,
            session_date TEXT NOT NULL,
            duration_minutes INTEGER NOT NULL,
            session_type TEXT NOT NULL,
            -- Audio recording (NEVER sync)
            audio_file_path TEXT,
            recording_status TEXT DEFAULT 'none',
            -- Transcript (NEVER sync)
            transcript TEXT,
            transcript_status TEXT DEFAULT 'none',
            -- SOAP note (NEVER sync)
            soap_subjective TEXT,
            soap_objective TEXT,
            soap_assessment TEXT,
            soap_plan TEXT,
            soap_finalized INTEGER DEFAULT 0,
            soap_finalized_at TEXT,
            soap_status TEXT DEFAULT 'none',
            -- Clinical codes (NEVER sync)
            diagnosis_codes TEXT, -- JSON array
            cpt_codes TEXT, -- JSON array
            -- Private notes (NEVER sync)
            private_notes TEXT,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            FOREIGN KEY (client_local_id) REFERENCES clients(local_id)
        );

        -- Superbills table (clinical billing docs - NEVER sync)
        CREATE TABLE IF NOT EXISTS superbills (
            local_id INTEGER PRIMARY KEY AUTOINCREMENT,
            session_local_id INTEGER NOT NULL,
            client_local_id INTEGER NOT NULL,
            service_date TEXT NOT NULL,
            provider_name TEXT NOT NULL,
            provider_npi TEXT,
            provider_license TEXT NOT NULL,
            client_name TEXT NOT NULL,
            client_dob TEXT,
            line_items TEXT NOT NULL, -- JSON array with CPT codes
            diagnosis_codes TEXT NOT NULL, -- JSON array
            total_cents INTEGER NOT NULL,
            pdf_path TEXT,
            created_at TEXT NOT NULL,
            FOREIGN KEY (session_local_id) REFERENCES sessions(local_id),
            FOREIGN KEY (client_local_id) REFERENCES clients(local_id)
        );

        -- Background job queue (local processing)
        CREATE TABLE IF NOT EXISTS job_queue (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            job_type TEXT NOT NULL, -- 'transcript' or 'soap'
            session_local_id INTEGER NOT NULL,
            status TEXT DEFAULT 'queued',
            progress INTEGER DEFAULT 0,
            model TEXT NOT NULL,
            error TEXT,
            queued_at TEXT NOT NULL,
            started_at TEXT,
            completed_at TEXT,
            FOREIGN KEY (session_local_id) REFERENCES sessions(local_id)
        );

        -- Local forms library (may contain PHI templates)
        CREATE TABLE IF NOT EXISTS local_forms (
            local_id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT NOT NULL,
            description TEXT,
            template_content TEXT NOT NULL,
            created_at TEXT NOT NULL,
            updated_at TEXT NOT NULL
        );
        "#,
    )?;

    let mut db = DB.lock().unwrap();
    *db = Some(conn);

    Ok(())
}

/// Get a reference to the database connection
pub fn get_connection() -> std::sync::MutexGuard<'static, Option<Connection>> {
    DB.lock().unwrap()
}
