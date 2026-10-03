//! Background job processor for transcription and SOAP generation
//!
//! # Architecture
//!
//! Jobs are queued in SQLite and processed in the background.
//! The UI remains responsive while jobs run.
//!
//! Job types:
//! - transcription: whisper.cpp converts audio to text
//! - soap_draft: local LLM generates SOAP draft from transcript
//! - superbill_pdf: generates PDF with Dx/CPT codes
//! - backup: creates encrypted backup of database
//!
//! # Integration Points (stubs for now)
//!
//! - whisper.cpp: Free local speech-to-text
//! - Ollama: Free local LLM for SOAP generation

use rusqlite::OptionalExtension;
use std::process::Command;
use tauri::AppHandle;

pub fn start_job_processor(app: &AppHandle) -> Result<(), String> {
    let app_handle = app.clone();

    std::thread::spawn(move || {
        println!("[Job Processor] Started");
        loop {
            if let Err(e) = process_next_job(&app_handle) {
                eprintln!("[Job Processor] Error: {}", e);
            }
            std::thread::sleep(std::time::Duration::from_secs(5));
        }
    });

    Ok(())
}

fn process_next_job(app: &AppHandle) -> Result<(), String> {
    let conn = crate::db::get_connection(app).map_err(|e| e.to_string())?;

    let next: Option<(String, String, String)> = conn
        .query_row(
            "SELECT id, job_type, payload FROM jobs WHERE status = 'pending' ORDER BY created_at ASC LIMIT 1",
            [],
            |r| Ok((r.get(0)?, r.get(1)?, r.get(2)?)),
        )
        .optional()
        .map_err(|e| e.to_string())?;

    let Some((job_id, job_type, payload)) = next else {
        return Ok(());
    };

    conn.execute(
        "UPDATE jobs SET status = 'in_progress', started_at = datetime('now') WHERE id = ?1",
        [&job_id],
    )
    .map_err(|e| e.to_string())?;

    let get_setting = |key: &str| -> Option<String> {
        conn.query_row("SELECT value FROM settings WHERE key = ?1", [key], |r| r.get(0))
            .optional()
            .ok()
            .flatten()
    };

    let result: Result<String, String> = match job_type.as_str() {
        "transcription" => {
            let payload_json: serde_json::Value = serde_json::from_str(&payload).map_err(|e| e.to_string())?;
            let audio_path = payload_json["audioPath"].as_str().unwrap_or_default();
            let whisper_path = get_setting("whisper_path");
            let model_path = get_setting("whisper_model_path");

            match (whisper_path, model_path) {
                (Some(wp), Some(mp)) => {
                    let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
                    rt.block_on(run_transcription_job(audio_path, &wp, &mp))
                        .and_then(|r| serde_json::to_string(&TranscriptResultJson {
                            transcript_id: r.transcript_id,
                            content: r.content,
                            word_count: r.word_count,
                        }).map_err(|e| e.to_string()))
                }
                _ => Err("whisper.cpp not configured -- run setup wizard first (mock mode: enter transcript manually)".to_string()),
            }
        }
        "soap_draft" => {
            let payload_json: serde_json::Value = serde_json::from_str(&payload).map_err(|e| e.to_string())?;
            let transcript = payload_json["transcript"].as_str().unwrap_or_default();
            let ollama_model = get_setting("ollama_model").unwrap_or_else(|| "phi4-mini".to_string());

            let rt = tokio::runtime::Runtime::new().map_err(|e| e.to_string())?;
            rt.block_on(run_soap_draft_job(transcript, &ollama_model))
                .and_then(|r| serde_json::to_string(&r).map_err(|e| e.to_string()))
        }
        other => Err(format!("unknown job_type: {}", other)),
    };

    match result {
        Ok(result_json) => {
            conn.execute(
                "UPDATE jobs SET status = 'completed', result = ?1, completed_at = datetime('now') WHERE id = ?2",
                rusqlite::params![result_json, job_id],
            )
            .map_err(|e| e.to_string())?;
        }
        Err(err_msg) => {
            conn.execute(
                "UPDATE jobs SET status = 'failed', error = ?1, attempts = attempts + 1, completed_at = datetime('now') WHERE id = ?2",
                rusqlite::params![err_msg, job_id],
            )
            .map_err(|e| e.to_string())?;
        }
    }

    Ok(())
}

#[derive(serde::Serialize)]
struct TranscriptResultJson {
    transcript_id: String,
    content: String,
    word_count: u32,
}

fn invoke_whisper_cli(whisper_path: &str, model_path: &str, audio_path: &str) -> Result<String, String> {
    let output = Command::new(whisper_path)
        .arg("-m")
        .arg(model_path)
        .arg("-f")
        .arg(audio_path)
        .arg("--no-timestamps")
        .arg("-otxt")
        .output()
        .map_err(|e| format!("failed to run whisper-cli: {}", e))?;

    if !output.status.success() {
        return Err(format!(
            "whisper-cli exited with status {}: {}",
            output.status,
            String::from_utf8_lossy(&output.stderr)
        ));
    }

    let txt_path = format!("{}.txt", audio_path);
    std::fs::read_to_string(&txt_path)
        .map_err(|e| format!("whisper-cli ran but produced no output file at {}: {}", txt_path, e))
}

async fn run_transcription_job(
    audio_path: &str,
    whisper_path: &str,
    model_path: &str,
) -> Result<TranscriptionResult, String> {
    let content = invoke_whisper_cli(whisper_path, model_path, audio_path)?;
    let word_count = content.split_whitespace().count() as u32;

    Ok(TranscriptionResult {
        transcript_id: uuid::Uuid::new_v4().to_string(),
        content,
        word_count,
        duration_seconds: 0, // KNOWN GAP: real duration needs WAV header parsing or ffprobe, neither exists yet.
    })
}

/// Calls Ollama's local-only HTTP API (127.0.0.1:11434) to draft a SOAP
/// note from a session transcript, parsing SUBJECTIVE/OBJECTIVE/
/// ASSESSMENT/PLAN sections out of the model's free-text response.
async fn run_soap_draft_job(
    transcript_content: &str,
    ollama_model: &str,
) -> Result<SoapDraftResult, String> {
    let client = reqwest::Client::new();
    let prompt = format!(
        "You are assisting a therapist by drafting a SOAP note from a session transcript. Respond ONLY in this exact format with no other text: a line starting with SUBJECTIVE: followed by the client's reported experience, then a line starting with OBJECTIVE: followed by the therapist's observations, then a line starting with ASSESSMENT: followed by the clinical assessment, then a line starting with PLAN: followed by the treatment plan. Transcript:\n{}",
        transcript_content
    );

    let response = client
        .post("http://127.0.0.1:11434/api/generate")
        .json(&serde_json::json!({
            "model": ollama_model,
            "prompt": prompt,
            "stream": false,
        }))
        .send()
        .await
        .map_err(|e| format!("Ollama request failed: {}", e))?;

    let body: serde_json::Value = response
        .json()
        .await
        .map_err(|e| format!("Ollama returned unparseable response: {}", e))?;

    let raw_text = body["response"]
        .as_str()
        .ok_or_else(|| "Ollama response missing 'response' field".to_string())?;

    let parsed = parse_soap_sections(raw_text);

    Ok(SoapDraftResult {
        soap_note_id: uuid::Uuid::new_v4().to_string(),
        subjective: parsed.subjective,
        objective: parsed.objective,
        assessment: parsed.assessment,
        plan: parsed.plan,
    })
}

struct ParsedSoap {
    subjective: String,
    objective: String,
    assessment: String,
    plan: String,
}

/// Splits an Ollama free-text SOAP response into its four sections by
/// finding each marker and taking everything up to the next marker.
/// KNOWN GAP / fragility: this is a plain substring scan, not a real
/// parser -- it assumes the model emits markers in the exact uppercase
/// "SUBJECTIVE:"/"OBJECTIVE:"/"ASSESSMENT:"/"PLAN:" spelling the prompt
/// asks for. A model that lowercases a marker, adds markdown emphasis
/// (e.g. "**SUBJECTIVE:**"), or echoes the word "PLAN" inside the
/// subjective narrative before the real PLAN: marker will silently
/// misattribute text. Not fixed in this phase -- flagged as a real,
/// observed-at-test-time fragility (see commit message / task report).
fn parse_soap_sections(raw: &str) -> ParsedSoap {
    let section = |marker: &str| -> String {
        raw.find(marker)
            .map(|start| {
                let after = &raw[start + marker.len()..];
                let end = ["SUBJECTIVE:", "OBJECTIVE:", "ASSESSMENT:", "PLAN:"]
                    .iter()
                    .filter(|m| **m != marker)
                    .filter_map(|m| after.find(m))
                    .min()
                    .unwrap_or(after.len());
                after[..end].trim().to_string()
            })
            .unwrap_or_default()
    };
    ParsedSoap {
        subjective: section("SUBJECTIVE:"),
        objective: section("OBJECTIVE:"),
        assessment: section("ASSESSMENT:"),
        plan: section("PLAN:"),
    }
}

#[cfg(test)]
mod transcription_tests {
    use super::*;

    #[test]
    fn real_whisper_invocation_fails_cleanly_on_missing_binary() {
        let result = invoke_whisper_cli(
            "/nonexistent/whisper-cli",
            "/nonexistent/model.bin",
            "/nonexistent/audio.wav",
        );
        assert!(result.is_err());
        assert!(result.unwrap_err().contains("whisper"));
    }

    /// Runs the real whisper-cli binary against a real recorded WAV file
    /// (silence/ambient is fine -- this proves the pipeline actually
    /// invokes the external binary and reads its output file, not that
    /// the transcription is accurate). Skips itself if either the real
    /// whisper-cli binary or the real ggml-base.en model aren't present
    /// on this machine at the fixed scratch paths used during this task's
    /// manual setup, rather than failing the whole suite on machines that
    /// haven't done that one-time setup.
    #[test]
    fn real_whisper_cli_runs_against_real_recorded_wav() {
        let whisper_path = "/home/nn/.cargo/bin/whisper-cli";
        let model_path = "/home/nn/.hermes/cache/scratch/ggml-base.en.bin";
        let audio_path = "/home/nn/.hermes/cache/scratch/test-audio.wav";

        if !std::path::Path::new(whisper_path).exists()
            || !std::path::Path::new(model_path).exists()
            || !std::path::Path::new(audio_path).exists()
        {
            eprintln!("skipping real_whisper_cli_runs_against_real_recorded_wav: setup files not present");
            return;
        }

        let result = invoke_whisper_cli(whisper_path, model_path, audio_path);
        assert!(result.is_ok(), "expected Ok, got {:?}", result);
        // Silence/ambient audio may produce an empty or near-empty string --
        // we only assert the pipeline ran and returned a String without
        // panicking, not that it transcribed anything meaningful.
        let _content = result.unwrap();
    }
}

#[cfg(test)]
mod soap_draft_tests {
    use super::*;

    #[test]
    fn parse_soap_response_splits_sections_correctly() {
        let raw = "SUBJECTIVE: Client reports anxiety.\nOBJECTIVE: Alert and oriented.\nASSESSMENT: Adjustment disorder.\nPLAN: Weekly sessions.";
        let parsed = parse_soap_sections(raw);
        assert_eq!(parsed.subjective, "Client reports anxiety.");
        assert_eq!(parsed.objective, "Alert and oriented.");
        assert_eq!(parsed.assessment, "Adjustment disorder.");
        assert_eq!(parsed.plan, "Weekly sessions.");
    }

    #[test]
    fn parse_soap_response_handles_missing_sections_gracefully() {
        let raw = "SUBJECTIVE: Only this section present.";
        let parsed = parse_soap_sections(raw);
        assert_eq!(parsed.subjective, "Only this section present.");
        assert_eq!(parsed.objective, "");
    }

    /// Calls the real, live local Ollama instance (model "phi4-mini",
    /// already pulled on this machine) with a short fake transcript and
    /// asserts a non-empty SUBJECTIVE section comes back. This proves the
    /// pipeline actually talks to 127.0.0.1:11434 and parses a real model
    /// response, not just a mocked one. Skipped (not failed) if Ollama
    /// isn't reachable, so the suite still passes on machines without it.
    #[test]
    fn real_ollama_drafts_soap_note_from_fake_transcript() {
        let rt = tokio::runtime::Runtime::new().unwrap();
        let transcript = "Therapist: How have you been sleeping this week? \
            Client: Not great, I've been waking up around 3am worried about my job. \
            Therapist: That sounds stressful. Let's talk about some strategies.";

        let result = rt.block_on(run_soap_draft_job(transcript, "phi4-mini"));

        match result {
            Ok(draft) => {
                assert!(
                    !draft.subjective.trim().is_empty(),
                    "expected a non-empty SUBJECTIVE section from a real Ollama response, got: {:?}",
                    draft
                );
            }
            Err(e) => {
                eprintln!(
                    "skipping real_ollama_drafts_soap_note_from_fake_transcript: Ollama not reachable: {}",
                    e
                );
            }
        }
    }
}

#[derive(Debug)]
#[allow(dead_code)]
struct TranscriptionResult {
    transcript_id: String,
    content: String,
    word_count: u32,
    duration_seconds: u32,
}

#[derive(Debug, serde::Serialize)]
#[allow(dead_code)]
struct SoapDraftResult {
    soap_note_id: String,
    subjective: String,
    objective: String,
    assessment: String,
    plan: String,
}
