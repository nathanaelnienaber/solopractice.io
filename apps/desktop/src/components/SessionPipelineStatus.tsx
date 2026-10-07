/**
 * Live status for local transcription → SOAP draft jobs for one session.
 * Wired to get_session_pipeline_status so the therapist never stares at a
 * blank SOAP screen with no idea whether whisper/Ollama are working.
 */

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

type Tone = "muted" | "info" | "success" | "warning" | "destructive";

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

const toneClasses: Record<Tone, string> = {
  muted: "border-border bg-muted/40 text-muted-foreground",
  info: "border-border bg-primary/5 text-foreground",
  success: "border-success/30 bg-success/10 text-foreground",
  warning: "border-warning/30 bg-warning/10 text-foreground",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function SessionPipelineStatusPanel({
  status,
  loading,
  loadError,
  mode,
}: {
  status: SessionPipelineStatusData | null;
  loading?: boolean;
  loadError?: string | null;
  /** waiting = full-screen wait; editor = banner above SOAP fields */
  mode: "waiting" | "editor";
}) {
  if (loadError) {
    return (
      <div className={`rounded-lg border px-4 py-3 text-sm ${toneClasses.destructive}`}>
        Could not load local AI status: {loadError}
      </div>
    );
  }

  if (!status && loading) {
    return (
      <div className={`rounded-lg border px-4 py-3 text-sm ${toneClasses.info}`}>
        Checking local transcription and SOAP draft status…
      </div>
    );
  }

  if (!status) {
    return (
      <div className={`rounded-lg border px-4 py-3 text-sm ${toneClasses.muted}`}>
        Local AI status unavailable. You can still write the SOAP note by hand.
      </div>
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

  const readinessBits: string[] = [];
  if (status.whisperReady) readinessBits.push("Speech-to-text is set up");
  else readinessBits.push("Speech-to-text is not set up — run Setup or write notes by hand");
  if (status.ollamaReady) readinessBits.push("Local drafting model is configured");
  else readinessBits.push("Local drafting model is not configured yet");

  return (
    <div className="space-y-3">
      <div className={`rounded-lg border px-4 py-3 text-sm space-y-2 ${toneClasses.info}`}>
        <p className="font-medium">
          {mode === "waiting"
            ? "Working on your session notes locally"
            : "Local AI status"}
        </p>
        <ul className="text-xs text-muted-foreground space-y-1 list-disc pl-4">
          {readinessBits.map((bit) => (
            <li key={bit}>{bit}</li>
          ))}
          {status.hasRecording && <li>Audio saved on this computer</li>}
          {status.hasTranscript && <li>Transcript saved for this session</li>}
        </ul>
      </div>

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
        <div className={`rounded-lg border px-4 py-3 text-sm ${toneClasses.warning}`}>
          Fields below are empty for now. You can type while local AI works — if a draft
          arrives and your fields are still blank, it will fill in automatically.
        </div>
      )}

      {mode === "editor" && !hasDraftContent && !txActive && !soapActive && (txFailed || soapFailed || !status.whisperReady) && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${toneClasses.muted}`}>
          No AI draft yet. Write the SOAP note below, or fix local speech-to-text / drafting
          in Setup and record again.
        </div>
      )}

      {mode === "waiting" && (txFailed || soapFailed) && (
        <div className={`rounded-lg border px-4 py-3 text-sm ${toneClasses.destructive}`}>
          Local AI could not finish. Open SOAP notes to write by hand, or check Setup
          (speech-to-text binary/model and local drafting).
        </div>
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
    <div className={`rounded-lg border px-4 py-3 text-sm ${toneClasses[tone]}`}>
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
    </div>
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
