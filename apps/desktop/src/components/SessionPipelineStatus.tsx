/**
 * Live status for local transcription → SOAP draft jobs for one session.
 * Wired to get_session_pipeline_status so the therapist never stares at a
 * blank SOAP screen with no idea whether whisper/Ollama are working.
 */

import { useEffect, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { ActionRow, Banner, Button, type BannerTone } from "./ui";

export interface SessionJobStatus {
  id: string;
  jobType: string;
  status: string;
  progress?: number | null;
  error?: string | null;
  createdAt: string;
  startedAt?: string | null;
  completedAt?: string | null;
}

export interface SessionPipelineStatusData {
  sessionId: string;
  hasRecording: boolean;
  recordingPath?: string | null;
  hasTranscript: boolean;
  transcriptionJob?: SessionJobStatus | null;
  soapDraftJob?: SessionJobStatus | null;
  soapNote?: {
    id?: string | null;
    subjective: string;
    objective: string;
    assessment: string;
    plan: string;
    isDraft: boolean;
  } | null;
  whisperReady: boolean;
  ollamaReady: boolean;
}

type Tone = BannerTone;

function jobLabel(status: string | undefined, kind: "transcription" | "soap"): {
  text: string;
  tone: Tone;
} {
  switch (status) {
    case "pending":
      return {
        text: kind === "transcription" ? "Transcription queued" : "SOAP draft queued",
        tone: "info",
      };
    case "in_progress":
      return {
        text: kind === "transcription" ? "Transcribing audio…" : "Drafting SOAP note…",
        tone: "warning",
      };
    case "completed":
      return {
        text: kind === "transcription" ? "Transcript ready" : "SOAP draft ready",
        tone: "success",
      };
    case "failed":
      return {
        text: kind === "transcription" ? "Transcription failed" : "SOAP draft failed",
        tone: "destructive",
      };
    default:
      return {
        text: kind === "transcription" ? "No transcription job yet" : "No SOAP draft job yet",
        tone: "muted",
      };
  }
}

function isWhisperNotConfiguredError(error: string | null | undefined): boolean {
  if (!error) return false;
  const lower = error.toLowerCase();
  return (
    lower.includes("whisper.cpp not configured") ||
    lower.includes("speech-to-text is not set up") ||
    lower.includes("run setup")
  );
}

export function SessionPipelineStatusPanel({
  status,
  loading,
  loadError,
  mode,
  onOpenSetup,
  onSpeechToTextReady,
}: {
  status: SessionPipelineStatusData | null;
  loading?: boolean;
  loadError?: string | null;
  /** waiting = full-screen wait; editor = banner above SOAP fields */
  mode: "waiting" | "editor";
  /** Opens the first-run Setup wizard (speech-to-text step). */
  onOpenSetup?: () => void;
  /** Called after an in-panel download finishes so the parent can re-poll. */
  onSpeechToTextReady?: () => void;
}) {
  const [downloadPct, setDownloadPct] = useState<number | null>(null);
  const [downloadLabel, setDownloadLabel] = useState<string | null>(null);
  const [downloadError, setDownloadError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  useEffect(() => {
    const unlisten = listen<{
      kind: string;
      label: string;
      percent: number | null;
      done: boolean;
      error: string | null;
    }>("ml-download-progress", (event) => {
      const p = event.payload;
      if (p.kind === "ollama-model") return;
      setDownloadLabel(p.label);
      setDownloadPct(p.percent != null ? Math.round(p.percent) : null);
      if (p.error) setDownloadError(p.error);
      if (p.done && !p.error) {
        setDownloadPct(100);
      }
    });
    return () => {
      unlisten.then((fn) => fn());
    };
  }, []);

  async function downloadSpeechToText() {
    setDownloading(true);
    setDownloadError(null);
    setDownloadPct(0);
    setDownloadLabel("Downloading speech-to-text…");
    try {
      await invoke("setup_speech_to_text", { model: null });
      setDownloadLabel("Speech-to-text ready on this computer");
      setDownloadPct(100);
      onSpeechToTextReady?.();
    } catch (err) {
      setDownloadError(err instanceof Error ? err.message : String(err));
    } finally {
      setDownloading(false);
    }
  }

  if (loadError) {
    return (
      <Banner tone="destructive">
        Could not load local AI status: {loadError}
      </Banner>
    );
  }

  if (!status && loading) {
    return (
      <Banner tone="info">
        Checking local transcription and SOAP draft status…
      </Banner>
    );
  }

  if (!status) {
    return (
      <Banner tone="muted">
        Local AI status unavailable. You can still write the SOAP note by hand below.
      </Banner>
    );
  }

  const tx = jobLabel(status.transcriptionJob?.status, "transcription");
  const soap = jobLabel(status.soapDraftJob?.status, "soap");
  const txFailed = status.transcriptionJob?.status === "failed";
  const soapFailed = status.soapDraftJob?.status === "failed";
  const txActive =
    status.transcriptionJob?.status === "pending" ||
    status.transcriptionJob?.status === "in_progress";
  const soapActive =
    status.soapDraftJob?.status === "pending" || status.soapDraftJob?.status === "in_progress";
  const hasDraftContent =
    !!status.soapNote &&
    [status.soapNote.subjective, status.soapNote.objective, status.soapNote.assessment, status.soapNote.plan]
      .some((s) => (s || "").trim().length > 0);

  const whisperMissing = !status.whisperReady;
  const whisperConfigError =
    isWhisperNotConfiguredError(status.transcriptionJob?.error) || whisperMissing;

  return (
    <div className="space-y-3">
      <Banner
        tone="info"
        title={
          mode === "waiting"
            ? "Working on your session notes locally"
            : "Local AI status"
        }
      >
        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
          <li>
            {status.whisperReady
              ? "Speech-to-text is set up on this computer"
              : "Speech-to-text is not set up yet"}
          </li>
          <li>
            {status.ollamaReady
              ? "Local drafting model is ready"
              : "Local drafting model is not configured yet"}
          </li>
          {status.hasRecording && <li>Audio saved on this computer</li>}
          {status.hasTranscript && <li>Transcript saved for this session</li>}
        </ul>
      </Banner>

      {whisperConfigError && (
        <Banner tone="warning" title="Speech-to-text needs a one-time download" className="space-y-3">
          <p className="text-xs text-muted-foreground">
            The AppImage does not ship the speech-to-text files. Download them once into this
            computer&apos;s SoloPractice data folder (nothing is uploaded). You can also skip and
            write the SOAP note by hand below.
          </p>
          {(downloading || downloadPct != null) && (
            <div>
              <div className="flex justify-between text-xs mb-1">
                <span>{downloadLabel || "Downloading…"}</span>
                {downloadPct != null && <span>{downloadPct}%</span>}
              </div>
              <div className="h-1.5 bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${downloadPct ?? 15}%` }}
                />
              </div>
            </div>
          )}
          {downloadError && (
            <p className="text-xs text-destructive whitespace-pre-wrap">{downloadError}</p>
          )}
          <ActionRow>
            <Button
              size="sm"
              disabled={downloading}
              loading={downloading}
              onClick={downloadSpeechToText}
            >
              {downloading ? "Downloading…" : "Download speech-to-text"}
            </Button>
            {onOpenSetup && (
              <Button size="sm" variant="outline" onClick={onOpenSetup}>
                Open Setup
              </Button>
            )}
          </ActionRow>
          <p className="text-xs text-muted-foreground">
            Manual SOAP notes always work — scroll down and type. After download, record again (or
            re-run transcription from a new Stop → auto-SOAP) to fill a draft.
          </p>
        </Banner>
      )}

      <StatusRow
        label={tx.text}
        tone={tx.tone}
        progress={
          status.transcriptionJob?.status === "in_progress"
            ? status.transcriptionJob.progress ?? undefined
            : undefined
        }
        detail={status.transcriptionJob?.error || undefined}
        spinning={txActive}
      />

      <StatusRow
        label={soap.text}
        tone={soap.tone}
        progress={
          status.soapDraftJob?.status === "in_progress"
            ? status.soapDraftJob.progress ?? undefined
            : undefined
        }
        detail={status.soapDraftJob?.error || undefined}
        spinning={soapActive}
      />

      {mode === "editor" && !hasDraftContent && (txActive || soapActive) && (
        <Banner tone="warning">
          Fields below are empty for now. You can type while local AI works — if a draft
          arrives and your fields are still blank, it will fill in automatically.
        </Banner>
      )}

      {mode === "editor" && !hasDraftContent && !txActive && !soapActive && !whisperConfigError && (
        <Banner tone="muted">
          No AI draft yet. Write the SOAP note below — your audio is already saved on this computer.
        </Banner>
      )}

      {mode === "waiting" && (txFailed || soapFailed) && !whisperConfigError && (
        <Banner tone="destructive">
          Local AI could not finish. Open SOAP notes to write by hand, or check Setup.
        </Banner>
      )}
    </div>
  );
}

function StatusRow({
  label,
  tone,
  progress,
  detail,
  spinning,
}: {
  label: string;
  tone: Tone;
  progress?: number | null;
  detail?: string;
  spinning?: boolean;
}) {
  return (
    <Banner tone={tone}>
      <div className="flex items-center gap-2">
        {spinning && <Spinner />}
        <span className="font-medium">{label}</span>
        {typeof progress === "number" && (
          <span className="text-xs text-muted-foreground ml-auto">{progress}%</span>
        )}
      </div>
      {typeof progress === "number" && (
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-warning transition-all duration-300"
            style={{ width: `${Math.min(100, Math.max(0, progress))}%` }}
          />
        </div>
      )}
      {spinning && typeof progress !== "number" && (
        <div className="mt-2 h-1.5 bg-muted rounded-full overflow-hidden">
          <div className="h-full w-1/3 bg-warning/80 animate-pulse rounded-full" />
        </div>
      )}
      {detail && <p className="mt-2 text-xs whitespace-pre-wrap">{detail}</p>}
    </Banner>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
      />
    </svg>
  );
}

/** True when fields are all empty/whitespace. */
export function soapFieldsAreEmpty(note: {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
} | null | undefined): boolean {
  if (!note) return true;
  return ![note.subjective, note.objective, note.assessment, note.plan].some(
    (s) => (s || "").trim().length > 0
  );
}
