/**
 * Session types — web-safe scheduling vs desktop clinical records.
 */

/**
 * Web-safe session/appointment data (scheduling only).
 * NO clinical content — just date/time for reminders.
 */
export interface WebSafeAppointment {
  id: string;
  clientId: string;
  /** ISO datetime of scheduled session */
  scheduledAt: string;
  /** Duration in minutes */
  durationMinutes: number;
  /** Session type for display */
  sessionType: 'individual' | 'telehealth' | 'group';
  /** Status */
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  /** Reminder tracking */
  reminderSentAt?: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Desktop session record — includes ALL clinical data.
 * NEVER serialize to web payloads.
 */
export interface DesktopSession {
  /** Local database ID */
  localId: number;
  /** Links to web appointment if scheduled there */
  webAppointmentId?: string;
  clientLocalId: number;
  /** ISO datetime */
  sessionDate: string;
  durationMinutes: number;
  sessionType: 'individual' | 'telehealth' | 'group';

  // ========== CLINICAL DATA — NEVER SYNC TO WEB ==========

  /** Path to local audio file (desktop only) */
  audioFilePath?: string;
  /** Audio recording status */
  recordingStatus: 'none' | 'recording' | 'completed' | 'failed';

  /** Transcript from Whisper STT (desktop only) */
  transcript?: string;
  /** Transcript job status */
  transcriptStatus: 'none' | 'queued' | 'processing' | 'completed' | 'failed';

  /** SOAP note (desktop only) */
  soapNote?: SOAPNote;
  /** SOAP generation status */
  soapStatus: 'none' | 'queued' | 'processing' | 'draft' | 'finalized';

  /** Diagnosis codes for this session (desktop only) */
  diagnosisCodes?: string[];
  /** CPT codes (desktop only) */
  cptCodes?: string[];

  /** Therapist's private session notes (desktop only) */
  privateNotes?: string;

  createdAt: string;
  updatedAt: string;
}

/**
 * SOAP note structure (desktop only — NEVER sync to web).
 */
export interface SOAPNote {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  /** Whether therapist has reviewed and finalized */
  finalized: boolean;
  finalizedAt?: string;
}

/**
 * Type guard for desktop session (has clinical fields).
 */
export function isDesktopSession(session: unknown): session is DesktopSession {
  if (!session || typeof session !== 'object') return false;
  const s = session as Record<string, unknown>;
  return (
    'localId' in s ||
    'audioFilePath' in s ||
    'transcript' in s ||
    'soapNote' in s ||
    'diagnosisCodes' in s ||
    'cptCodes' in s ||
    'privateNotes' in s
  );
}
