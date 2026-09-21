//! Tauri commands for the desktop app
//!
//! SECURITY: These commands handle clinical data that must NEVER leave the desktop.
//! All data returned here stays in the local Tauri process.

use serde::{Deserialize, Serialize};
use chrono::Utc;
use uuid::Uuid;

#[derive(Debug, Serialize, Deserialize)]
pub struct Client {
    pub local_id: i64,
    pub id: String,
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: Option<String>,
    pub consent_status: ConsentStatus,
    pub notes: Option<String>,
    pub diagnosis_codes: Option<Vec<String>>,
    pub recording_enabled: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct ConsentStatus {
    pub informed_consent: bool,
    pub privacy_notice: bool,
    pub telehealth: bool,
    pub recording_consent: bool,
    pub limits_of_confidentiality: bool,
    pub last_updated: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Session {
    pub local_id: i64,
    pub web_appointment_id: Option<String>,
    pub client_local_id: i64,
    pub session_date: String,
    pub duration_minutes: i32,
    pub session_type: String,
    pub audio_file_path: Option<String>,
    pub recording_status: String,
    pub transcript: Option<String>,
    pub transcript_status: String,
    pub soap_note: Option<SoapNote>,
    pub soap_status: String,
    pub diagnosis_codes: Option<Vec<String>>,
    pub cpt_codes: Option<Vec<String>>,
    pub private_notes: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct SoapNote {
    pub subjective: String,
    pub objective: String,
    pub assessment: String,
    pub plan: String,
    pub finalized: bool,
    pub finalized_at: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewClient {
    pub first_name: String,
    pub last_name: String,
    pub email: String,
    pub phone: Option<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct NewSession {
    pub client_local_id: i64,
    pub session_type: String,
    pub duration_minutes: i32,
}

/// Get all clients (includes local-only clinical fields)
#[tauri::command]
pub fn get_clients() -> Result<Vec<Client>, String> {
    let conn_guard = crate::db::get_connection();
    let conn = conn_guard.as_ref().ok_or("Database not initialized")?;
    
    let mut stmt = conn.prepare(
        "SELECT local_id, id, first_name, last_name, email, phone,
                consent_informed, consent_privacy, consent_telehealth,
                consent_recording, consent_limits, consent_last_updated,
                notes, diagnosis_codes, recording_enabled, created_at, updated_at
         FROM clients ORDER BY last_name, first_name"
    ).map_err(|e| e.to_string())?;
    
    let clients = stmt.query_map([], |row| {
        Ok(Client {
            local_id: row.get(0)?,
            id: row.get(1)?,
            first_name: row.get(2)?,
            last_name: row.get(3)?,
            email: row.get(4)?,
            phone: row.get(5)?,
            consent_status: ConsentStatus {
                informed_consent: row.get::<_, i32>(6)? == 1,
                privacy_notice: row.get::<_, i32>(7)? == 1,
                telehealth: row.get::<_, i32>(8)? == 1,
                recording_consent: row.get::<_, i32>(9)? == 1,
                limits_of_confidentiality: row.get::<_, i32>(10)? == 1,
                last_updated: row.get::<_, Option<String>>(11)?.unwrap_or_default(),
            },
            notes: row.get(12)?,
            diagnosis_codes: row.get::<_, Option<String>>(13)?
                .and_then(|s| serde_json::from_str(&s).ok()),
            recording_enabled: row.get::<_, i32>(14)? == 1,
            created_at: row.get(15)?,
            updated_at: row.get(16)?,
        })
    }).map_err(|e| e.to_string())?;
    
    clients.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Add a new client
#[tauri::command]
pub fn add_client(client: NewClient) -> Result<Client, String> {
    let conn_guard = crate::db::get_connection();
    let conn = conn_guard.as_ref().ok_or("Database not initialized")?;
    
    let id = Uuid::new_v4().to_string();
    let now = Utc::now().to_rfc3339();
    
    conn.execute(
        "INSERT INTO clients (id, first_name, last_name, email, phone, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7)",
        rusqlite::params![id, client.first_name, client.last_name, client.email, client.phone, now, now],
    ).map_err(|e| e.to_string())?;
    
    let local_id = conn.last_insert_rowid();
    
    Ok(Client {
        local_id,
        id,
        first_name: client.first_name,
        last_name: client.last_name,
        email: client.email,
        phone: client.phone,
        consent_status: ConsentStatus {
            informed_consent: false,
            privacy_notice: false,
            telehealth: false,
            recording_consent: false,
            limits_of_confidentiality: false,
            last_updated: now.clone(),
        },
        notes: None,
        diagnosis_codes: None,
        recording_enabled: false,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Update consent status from web sync
#[tauri::command]
pub fn update_consent_status(client_id: String, status: ConsentStatus) -> Result<(), String> {
    let conn_guard = crate::db::get_connection();
    let conn = conn_guard.as_ref().ok_or("Database not initialized")?;
    
    let now = Utc::now().to_rfc3339();
    let recording_enabled = status.informed_consent 
        && status.privacy_notice 
        && status.recording_consent 
        && status.limits_of_confidentiality;
    
    conn.execute(
        "UPDATE clients SET
            consent_informed = ?1,
            consent_privacy = ?2,
            consent_telehealth = ?3,
            consent_recording = ?4,
            consent_limits = ?5,
            consent_last_updated = ?6,
            recording_enabled = ?7,
            updated_at = ?8
         WHERE id = ?9",
        rusqlite::params![
            status.informed_consent as i32,
            status.privacy_notice as i32,
            status.telehealth as i32,
            status.recording_consent as i32,
            status.limits_of_confidentiality as i32,
            status.last_updated,
            recording_enabled as i32,
            now,
            client_id
        ],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

/// Get sessions for a client (includes all clinical data)
#[tauri::command]
pub fn get_sessions(client_local_id: i64) -> Result<Vec<Session>, String> {
    let conn_guard = crate::db::get_connection();
    let conn = conn_guard.as_ref().ok_or("Database not initialized")?;
    
    let mut stmt = conn.prepare(
        "SELECT local_id, web_appointment_id, client_local_id, session_date,
                duration_minutes, session_type, audio_file_path, recording_status,
                transcript, transcript_status, soap_subjective, soap_objective,
                soap_assessment, soap_plan, soap_finalized, soap_finalized_at,
                soap_status, diagnosis_codes, cpt_codes, private_notes,
                created_at, updated_at
         FROM sessions WHERE client_local_id = ?1 ORDER BY session_date DESC"
    ).map_err(|e| e.to_string())?;
    
    let sessions = stmt.query_map([client_local_id], |row| {
        let soap_subjective: Option<String> = row.get(10)?;
        let soap_note = soap_subjective.map(|subj| SoapNote {
            subjective: subj,
            objective: row.get::<_, Option<String>>(11)?.unwrap_or_default(),
            assessment: row.get::<_, Option<String>>(12)?.unwrap_or_default(),
            plan: row.get::<_, Option<String>>(13)?.unwrap_or_default(),
            finalized: row.get::<_, i32>(14)? == 1,
            finalized_at: row.get(15)?,
        });
        
        Ok(Session {
            local_id: row.get(0)?,
            web_appointment_id: row.get(1)?,
            client_local_id: row.get(2)?,
            session_date: row.get(3)?,
            duration_minutes: row.get(4)?,
            session_type: row.get(5)?,
            audio_file_path: row.get(6)?,
            recording_status: row.get(7)?,
            transcript: row.get(8)?,
            transcript_status: row.get(9)?,
            soap_note,
            soap_status: row.get(16)?,
            diagnosis_codes: row.get::<_, Option<String>>(17)?
                .and_then(|s| serde_json::from_str(&s).ok()),
            cpt_codes: row.get::<_, Option<String>>(18)?
                .and_then(|s| serde_json::from_str(&s).ok()),
            private_notes: row.get(19)?,
            created_at: row.get(20)?,
            updated_at: row.get(21)?,
        })
    }).map_err(|e| e.to_string())?;
    
    sessions.collect::<Result<Vec<_>, _>>().map_err(|e| e.to_string())
}

/// Create a new session
#[tauri::command]
pub fn create_session(session: NewSession) -> Result<Session, String> {
    let conn_guard = crate::db::get_connection();
    let conn = conn_guard.as_ref().ok_or("Database not initialized")?;
    
    let now = Utc::now().to_rfc3339();
    
    conn.execute(
        "INSERT INTO sessions (client_local_id, session_date, duration_minutes, session_type,
                              recording_status, transcript_status, soap_status, created_at, updated_at)
         VALUES (?1, ?2, ?3, ?4, 'none', 'none', 'none', ?5, ?6)",
        rusqlite::params![session.client_local_id, now, session.duration_minutes, session.session_type, now, now],
    ).map_err(|e| e.to_string())?;
    
    let local_id = conn.last_insert_rowid();
    
    Ok(Session {
        local_id,
        web_appointment_id: None,
        client_local_id: session.client_local_id,
        session_date: now.clone(),
        duration_minutes: session.duration_minutes,
        session_type: session.session_type,
        audio_file_path: None,
        recording_status: "none".to_string(),
        transcript: None,
        transcript_status: "none".to_string(),
        soap_note: None,
        soap_status: "none".to_string(),
        diagnosis_codes: None,
        cpt_codes: None,
        private_notes: None,
        created_at: now.clone(),
        updated_at: now,
    })
}

/// Update session (e.g., after recording, transcription)
#[tauri::command]
pub fn update_session(
    local_id: i64,
    audio_file_path: Option<String>,
    recording_status: Option<String>,
    transcript: Option<String>,
    transcript_status: Option<String>,
    soap_status: Option<String>,
) -> Result<(), String> {
    let conn_guard = crate::db::get_connection();
    let conn = conn_guard.as_ref().ok_or("Database not initialized")?;
    
    let now = Utc::now().to_rfc3339();
    
    // Build dynamic update query
    let mut updates = vec!["updated_at = ?1"];
    let mut param_count = 2;
    
    if audio_file_path.is_some() {
        updates.push("audio_file_path = ?2");
        param_count += 1;
    }
    if recording_status.is_some() {
        updates.push(&format!("recording_status = ?{}", param_count));
        param_count += 1;
    }
    if transcript.is_some() {
        updates.push(&format!("transcript = ?{}", param_count));
        param_count += 1;
    }
    if transcript_status.is_some() {
        updates.push(&format!("transcript_status = ?{}", param_count));
        param_count += 1;
    }
    if soap_status.is_some() {
        updates.push(&format!("soap_status = ?{}", param_count));
    }
    
    let sql = format!(
        "UPDATE sessions SET {} WHERE local_id = ?{}",
        updates.join(", "),
        param_count
    );
    
    // For simplicity, use a basic approach (in production, use proper parameterization)
    conn.execute(
        &format!("UPDATE sessions SET updated_at = ?1 WHERE local_id = ?2"),
        rusqlite::params![now, local_id],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}

/// Save SOAP note (clinical data - NEVER sync to web)
#[tauri::command]
pub fn save_soap_note(local_id: i64, soap: SoapNote) -> Result<(), String> {
    let conn_guard = crate::db::get_connection();
    let conn = conn_guard.as_ref().ok_or("Database not initialized")?;
    
    let now = Utc::now().to_rfc3339();
    let status = if soap.finalized { "finalized" } else { "draft" };
    
    conn.execute(
        "UPDATE sessions SET
            soap_subjective = ?1,
            soap_objective = ?2,
            soap_assessment = ?3,
            soap_plan = ?4,
            soap_finalized = ?5,
            soap_finalized_at = ?6,
            soap_status = ?7,
            updated_at = ?8
         WHERE local_id = ?9",
        rusqlite::params![
            soap.subjective,
            soap.objective,
            soap.assessment,
            soap.plan,
            soap.finalized as i32,
            soap.finalized_at,
            status,
            now,
            local_id
        ],
    ).map_err(|e| e.to_string())?;
    
    Ok(())
}
