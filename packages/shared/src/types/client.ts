/**
 * Client types — both desktop (full) and web-safe (ops-only) variants.
 */

/**
 * Web-safe client data (ops data only — syncs to web).
 * NO clinical information ever.
 */
export interface WebSafeClient {
  /** Opaque identifier — links desktop and web without exposing internal IDs */
  id: string;
  /** Client display name */
  firstName: string;
  lastName: string;
  /** Contact info for reminders/billing */
  email: string;
  phone?: string;
  /** Consent status flags (ops data, not clinical content) */
  consentStatus: ConsentStatusFlags;
  /** When client was created */
  createdAt: string;
  /** Last updated timestamp */
  updatedAt: string;
}

/**
 * Consent completion flags — ONLY status booleans, not clinical content.
 */
export interface ConsentStatusFlags {
  informedConsent: boolean;
  privacyNotice: boolean;
  telehealth: boolean;
  recordingConsent: boolean;
  limitsOfConfidentiality: boolean;
  /** ISO timestamp of last consent update */
  lastUpdated: string;
}

/**
 * Full client record (desktop only — includes clinical references).
 * NEVER serialize this to web payloads.
 */
export interface DesktopClient extends WebSafeClient {
  /** Internal desktop database ID */
  localId: number;
  /** References to local session records */
  sessionIds: number[];
  /** Whether recording is currently enabled (requires recordingConsent) */
  recordingEnabled: boolean;
  /** Local notes (may contain PHI — desktop only) */
  notes?: string;
  /** Diagnosis codes — NEVER sync to web */
  diagnosisCodes?: string[];
}

/**
 * Type guard to check if a value is a DesktopClient (has clinical fields).
 */
export function isDesktopClient(client: unknown): client is DesktopClient {
  if (!client || typeof client !== 'object') return false;
  const c = client as Record<string, unknown>;
  return (
    'localId' in c ||
    'sessionIds' in c ||
    'diagnosisCodes' in c ||
    'notes' in c
  );
}
