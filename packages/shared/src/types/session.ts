/**
 * Session types - DESKTOP ONLY
 *
 * ⚠️  CRITICAL SECURITY BOUNDARY ⚠️
 *
 * Session data contains clinical information and must never leave the desktop.
 */

import type { AppointmentId, ClientId, Timestamp } from "./common.js";
import type {
  RecordingId,
  SessionId,
  SoapNoteId,
  TranscriptId,
} from "./clinical.js";

export const SESSION_STATUS = [
  "scheduled",
  "in_progress",
  "recording",
  "completed",
  "cancelled",
] as const;

export type SessionStatus = (typeof SESSION_STATUS)[number];

export interface Session {
  id: SessionId;
  clientId: ClientId;
  appointmentId?: AppointmentId;
  status: SessionStatus;
  startedAt?: Timestamp;
  endedAt?: Timestamp;
  recordingId?: RecordingId;
  transcriptId?: TranscriptId;
  soapNoteId?: SoapNoteId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface SessionWithDetails extends Session {
  clientFirstName: string;
  clientLastName: string;
  hasRecording: boolean;
  hasTranscript: boolean;
  hasSoapNote: boolean;
  soapIsDraft?: boolean;
}
