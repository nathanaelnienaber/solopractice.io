/**
 * Clinical types - DESKTOP ONLY
 *
 * ⚠️  CRITICAL SECURITY BOUNDARY ⚠️
 *
 * These types contain PHI and MUST NEVER:
 * - Be synced to the web application
 * - Be sent over the network to our servers
 * - Leave the local desktop machine
 *
 * This file is exported ONLY via @solopractice/shared/desktop
 * and is NOT exported via @solopractice/shared/web
 */

import type { ClientId, Timestamp } from "./common.js";

export type SessionId = string & { readonly __brand: "SessionId" };
export type RecordingId = string & { readonly __brand: "RecordingId" };
export type TranscriptId = string & { readonly __brand: "TranscriptId" };
export type SoapNoteId = string & { readonly __brand: "SoapNoteId" };

export function createSessionId(id: string): SessionId {
  return id as SessionId;
}

export function createRecordingId(id: string): RecordingId {
  return id as RecordingId;
}

export function createTranscriptId(id: string): TranscriptId {
  return id as TranscriptId;
}

export function createSoapNoteId(id: string): SoapNoteId {
  return id as SoapNoteId;
}

export interface DiagnosisCode {
  code: string;
  description: string;
  isPrimary: boolean;
}

export interface ProcedureCode {
  code: string;
  description: string;
  units: number;
  feeScheduleAmountCents: number;
}

export interface SoapNote {
  id: SoapNoteId;
  sessionId: SessionId;
  clientId: ClientId;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  diagnosisCodes: DiagnosisCode[];
  procedureCodes: ProcedureCode[];
  isDraft: boolean;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  signedAt?: Timestamp;
  signedBy?: string;
}

export interface Recording {
  id: RecordingId;
  sessionId: SessionId;
  filePath: string;
  durationSeconds: number;
  format: "wav" | "mp3" | "m4a";
  sizeBytes: number;
  createdAt: Timestamp;
}

export interface Transcript {
  id: TranscriptId;
  sessionId: SessionId;
  recordingId: RecordingId;
  content: string;
  modelUsed: string;
  createdAt: Timestamp;
}

export interface LocalForm {
  id: string;
  name: string;
  content: string;
  clientId?: ClientId;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}
