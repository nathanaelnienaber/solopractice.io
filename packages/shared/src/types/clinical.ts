/**
 * Clinical types — DESKTOP ONLY, NEVER on the wire.
 *
 * These types exist to make the PHI boundary explicit in TypeScript.
 * Any code that touches these types must remain desktop-only.
 */

/**
 * Marker type for clinical data that must never leave the desktop.
 * Use this to brand types that contain PHI.
 */
declare const CLINICAL_BRAND: unique symbol;

/**
 * Branded type for clinical strings (transcripts, notes, etc.).
 */
export type ClinicalString = string & { readonly [CLINICAL_BRAND]: 'clinical' };

/**
 * Branded type for diagnosis codes (ICD-10).
 */
export type DiagnosisCode = string & { readonly [CLINICAL_BRAND]: 'diagnosis' };

/**
 * Branded type for procedure codes (CPT).
 */
export type ProcedureCode = string & { readonly [CLINICAL_BRAND]: 'procedure' };

/**
 * Audio recording metadata (desktop only).
 */
export interface AudioRecording {
  localId: number;
  sessionLocalId: number;
  /** Path to audio file on local disk */
  filePath: string;
  /** Audio format */
  format: 'wav' | 'mp3' | 'webm' | 'm4a';
  /** Duration in seconds */
  durationSeconds: number;
  /** File size in bytes */
  fileSizeBytes: number;
  /** Recording timestamp */
  recordedAt: string;
  /** Encryption status */
  encrypted: boolean;
  createdAt: string;
}

/**
 * Transcript job (local STT queue).
 */
export interface TranscriptJob {
  localId: number;
  sessionLocalId: number;
  audioRecordingId: number;
  /** Job status */
  status: 'queued' | 'processing' | 'completed' | 'failed';
  /** Progress 0-100 */
  progress: number;
  /** Whisper model used */
  model: 'tiny' | 'base' | 'small' | 'medium' | 'large';
  /** Error message if failed */
  error?: string;
  /** Result transcript (clinical string) */
  transcript?: ClinicalString;
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * SOAP generation job (local LLM queue).
 */
export interface SOAPJob {
  localId: number;
  sessionLocalId: number;
  transcriptJobId: number;
  /** Job status */
  status: 'queued' | 'processing' | 'completed' | 'failed';
  /** LLM model used (e.g., Ollama model name) */
  model: string;
  /** Error message if failed */
  error?: string;
  /** Generated SOAP draft */
  soapDraft?: {
    subjective: ClinicalString;
    objective: ClinicalString;
    assessment: ClinicalString;
    plan: ClinicalString;
  };
  queuedAt: string;
  startedAt?: string;
  completedAt?: string;
}

/**
 * List of field names that are ALWAYS clinical (never web-safe).
 */
export const CLINICAL_FIELD_NAMES = [
  'transcript',
  'soapNote',
  'soapDraft',
  'diagnosisCodes',
  'cptCodes',
  'privateNotes',
  'audioFilePath',
  'lineItems',
  'subjective',
  'objective',
  'assessment',
  'plan',
] as const;

export type ClinicalFieldName = (typeof CLINICAL_FIELD_NAMES)[number];
