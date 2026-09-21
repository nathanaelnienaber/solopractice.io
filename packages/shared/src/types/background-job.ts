/**
 * Background job types - DESKTOP ONLY
 *
 * These types define the job queue for slow operations like:
 * - Audio transcription (whisper.cpp)
 * - SOAP draft generation (local LLM)
 *
 * Jobs run in the background and must not block the UI.
 */

import type { ClientId, Timestamp } from "./common.js";
import type { RecordingId, SessionId, TranscriptId } from "./clinical.js";

export type JobId = string & { readonly __brand: "JobId" };

export function createJobId(id: string): JobId {
  return id as JobId;
}

export const JOB_TYPE = [
  "transcription",
  "soap_draft",
  "superbill_pdf",
  "backup",
] as const;

export type JobType = (typeof JOB_TYPE)[number];

export const JOB_STATUS = [
  "pending",
  "queued",
  "in_progress",
  "completed",
  "failed",
  "cancelled",
] as const;

export type JobStatus = (typeof JOB_STATUS)[number];

export interface BackgroundJob {
  id: JobId;
  type: JobType;
  status: JobStatus;
  progress?: number;
  payload: JobPayload;
  result?: JobResult;
  error?: string;
  attempts: number;
  maxAttempts: number;
  createdAt: Timestamp;
  startedAt?: Timestamp;
  completedAt?: Timestamp;
}

export type JobPayload =
  | TranscriptionJobPayload
  | SoapDraftJobPayload
  | SuperbillPdfJobPayload
  | BackupJobPayload;

export interface TranscriptionJobPayload {
  type: "transcription";
  sessionId: SessionId;
  recordingId: RecordingId;
  audioFilePath: string;
  modelSize?: "tiny" | "base" | "small" | "medium" | "large";
}

export interface SoapDraftJobPayload {
  type: "soap_draft";
  sessionId: SessionId;
  clientId: ClientId;
  transcriptId: TranscriptId;
  transcriptContent: string;
}

export interface SuperbillPdfJobPayload {
  type: "superbill_pdf";
  sessionId: SessionId;
  superbillId: string;
}

export interface BackupJobPayload {
  type: "backup";
  targetPath: string;
  includeRecordings: boolean;
}

export type JobResult =
  | TranscriptionJobResult
  | SoapDraftJobResult
  | SuperbillPdfJobResult
  | BackupJobResult;

export interface TranscriptionJobResult {
  type: "transcription";
  transcriptId: TranscriptId;
  wordCount: number;
  durationSeconds: number;
}

export interface SoapDraftJobResult {
  type: "soap_draft";
  soapNoteId: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export interface SuperbillPdfJobResult {
  type: "superbill_pdf";
  pdfPath: string;
  sizeBytes: number;
}

export interface BackupJobResult {
  type: "backup";
  backupPath: string;
  sizeBytes: number;
  recordingsIncluded: number;
}

export interface JobQueueStats {
  pending: number;
  inProgress: number;
  completed: number;
  failed: number;
}
