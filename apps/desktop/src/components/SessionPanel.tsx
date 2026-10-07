import { useCallback, useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { save } from "@tauri-apps/plugin-dialog";
import type { SessionWithDetails, SoapNote } from "@solopractice/shared/desktop";
import { SoapEditor } from "./SoapEditor";
import { useAudioRecorder } from "../hooks/useAudioRecorder";
import { classifyMicFailure, micFailureUserMessage } from "../lib/audioCapture";
import {
  SessionPipelineStatusPanel,
  soapFieldsAreEmpty,
  type SessionPipelineStatusData,
} from "./SessionPipelineStatus";
import {
  ActionRow,
  Banner,
  Button,
  EmptyState,
  LoadingState,
  PageBody,
  PageHeader,
  PageShell,
} from "./ui";

interface MlSetupStatus {
  whisperModelDownloaded: boolean;
  whisperBinaryAvailable: boolean;
  ollamaRunning: boolean;
  ollamaModels: string[];
}

interface SessionPanelProps {
  clientId: string | null;
  session: SessionWithDetails | null;
  onSessionChange: (session: SessionWithDetails | null) => void;
  onBack: () => void;
  onViewHistory?: () => void;
  /** Re-open first-run Setup (speech-to-text download). */
  onOpenSetup?: () => void;
}

type SessionState =
  | "idle"
  | "recording"
  | "saving"
  | "waiting_pipeline"
  | "editing";

type StopChoice =
  | "go_soap"
  | "continue"
  | "save_audio"
  | "auto_soap";

export function SessionPanel({
  clientId,
  onBack,
  onViewHistory,
  onOpenSetup,
}: SessionPanelProps) {
  const [state, setState] = useState<SessionState>("idle");
  const [soapNote, setSoapNote] = useState<Partial<SoapNote> | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [showStopMenu, setShowStopMenu] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [pipeline, setPipeline] = useState<SessionPipelineStatusData | null>(null);
  const [pipelineError, setPipelineError] = useState<string | null>(null);
  const [pipelineLoading, setPipelineLoading] = useState(false);
  const [recorderState, recorderControls] = useAudioRecorder();
  const soapNoteRef = useRef(soapNote);
  soapNoteRef.current = soapNote;
  const stateRef = useRef(state);
  stateRef.current = state;
  const mlReadyRef = useRef<{ whisperReady: boolean; ollamaReady: boolean } | null>(null);

  const refreshMlReadiness = useCallback(async () => {
    try {
      const ml = await invoke<MlSetupStatus>("detect_ml_setup");
      mlReadyRef.current = {
        whisperReady: ml.whisperBinaryAvailable && ml.whisperModelDownloaded,
        ollamaReady: ml.ollamaRunning && ml.ollamaModels.length > 0,
      };
    } catch {
      // Non-fatal — pipeline status still reports job rows.
    }
  }, []);

  const refreshPipeline = useCallback(async (sid: string) => {
    setPipelineLoading(true);
    try {
      const result = await invoke<SessionPipelineStatusData>("get_session_pipeline_status", {
        sessionId: sid,
      });
      const ml = mlReadyRef.current;
      const merged: SessionPipelineStatusData = ml
        ? {
            ...result,
            whisperReady: ml.whisperReady,
            ollamaReady: ml.ollamaReady,
          }
        : result;
      setPipeline(merged);
      setPipelineError(null);
      return merged;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setPipelineError(message);
      return null;
    } finally {
      setPipelineLoading(false);
    }
  }, []);

  // Poll pipeline while waiting or editing after a recording.
  useEffect(() => {
    if (!sessionId) return;
    if (state !== "waiting_pipeline" && state !== "editing") return;

    let cancelled = false;
    const tick = async () => {
      if (cancelled) return;
      const result = await refreshPipeline(sessionId);
      if (cancelled || !result) return;

      const currentState = stateRef.current;
      const currentNote = soapNoteRef.current;

      // Auto-fill SOAP when a draft arrives and the therapist hasn't typed yet.
      if (
        result.soapNote &&
        currentState === "editing" &&
        soapFieldsAreEmpty(currentNote)
      ) {
        setSoapNote({
          subjective: result.soapNote.subjective || "",
          objective: result.soapNote.objective || "",
          assessment: result.soapNote.assessment || "",
          plan: result.soapNote.plan || "",
          isDraft: result.soapNote.isDraft,
        });
      }

      if (currentState === "waiting_pipeline") {
        const soapDone = result.soapDraftJob?.status === "completed" && result.soapNote;
        if (soapDone) {
          setSoapNote({
            subjective: result.soapNote!.subjective || "",
            objective: result.soapNote!.objective || "",
            assessment: result.soapNote!.assessment || "",
            plan: result.soapNote!.plan || "",
            isDraft: result.soapNote!.isDraft,
          });
          setState("editing");
        }
      }
    };

    void refreshMlReadiness().then(tick);
    const interval = setInterval(tick, 2000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [sessionId, state, refreshPipeline, refreshMlReadiness]);

  if (!clientId) {
    return (
      <PageShell>
        <EmptyState
          className="h-full"
          title="Select a client to start a session"
          description="Choose someone with recording consent from Clients."
        />
      </PageShell>
    );
  }

  async function startRecording() {
    try {
      setStatusMessage(null);
      const newSessionId = await invoke<string>("start_recording", { clientId });
      setSessionId(newSessionId);
      await recorderControls.startRecording();
      setState("recording");
      setShowStopMenu(false);
    } catch (error) {
      console.error("Failed to start recording:", error);
      const kind = classifyMicFailure(error);
      const message =
        kind !== "unknown"
          ? micFailureUserMessage(kind, error)
          : recorderState.error ||
            (error instanceof Error ? error.message : String(error));
      alert("Could not start recording: " + message);
    }
  }

  function requestStop() {
    // Pause first so "Continue recording" can resume without losing audio.
    if (recorderState.isRecording && !recorderState.isPaused) {
      recorderControls.pauseRecording();
    }
    setShowStopMenu(true);
  }

  function continueRecording() {
    setShowStopMenu(false);
    recorderControls.resumeRecording();
  }

  async function finalizeRecording(options: {
    enqueueTranscription: boolean;
    next: "editing" | "waiting_pipeline" | "idle";
    exportCopy?: boolean;
  }) {
    if (!sessionId) {
      console.error("finalizeRecording called with no active sessionId");
      setState("idle");
      setShowStopMenu(false);
      return;
    }

    setShowStopMenu(false);
    setState("saving");
    setStatusMessage("Saving audio on this computer…");

    try {
      const audioBlob = await recorderControls.stopRecording();
      const audioBytes = new Uint8Array(await audioBlob.arrayBuffer());
      const format = mimeTypeToExtension(audioBlob.type);
      const bytesArray = Array.from(audioBytes);

      const savedPath = await invoke<string>("save_recording_file", {
        sessionId,
        audioBytes: bytesArray,
        format,
        enqueueTranscription: options.enqueueTranscription,
      });
      await invoke("stop_recording", { sessionId });

      if (options.exportCopy) {
        setStatusMessage("Choose where to save a copy of the audio…");
        const dest = await save({
          defaultPath: `session-${sessionId}.${format}`,
          filters: [
            {
              name: "Audio",
              extensions: [format],
            },
          ],
        });
        if (dest) {
          await invoke("export_audio_bytes", {
            destPath: dest,
            audioBytes: bytesArray,
          });
          setStatusMessage(`Audio copy saved to ${dest}`);
        } else {
          setStatusMessage(
            `Audio kept in the app library${savedPath ? ` (${savedPath})` : ""}. Save canceled.`
          );
        }
      }

      if (options.next === "idle") {
        setState("idle");
        setSoapNote(null);
        setSessionId(null);
        recorderControls.resetRecording();
        return;
      }

      setSoapNote({
        subjective: "",
        objective: "",
        assessment: "",
        plan: "",
        isDraft: true,
      });
      setPipeline(null);
      setState(options.next);
      setStatusMessage(null);
      await refreshPipeline(sessionId);
    } catch (error) {
      console.error("Error processing recording:", error);
      setStatusMessage(
        "Could not finish saving: " +
          (error instanceof Error ? error.message : String(error))
      );
      setSoapNote({
        subjective: "",
        objective: "",
        assessment: "",
        plan: "",
        isDraft: true,
      });
      setState("editing");
    }
  }

  async function handleStopChoice(choice: StopChoice) {
    switch (choice) {
      case "continue":
        continueRecording();
        break;
      case "go_soap":
        await finalizeRecording({
          enqueueTranscription: true,
          next: "editing",
        });
        break;
      case "save_audio":
        await finalizeRecording({
          enqueueTranscription: false,
          next: "idle",
          exportCopy: true,
        });
        break;
      case "auto_soap":
        await finalizeRecording({
          enqueueTranscription: true,
          next: "waiting_pipeline",
        });
        break;
    }
  }

  async function saveSoapNote() {
    if (!soapNote || !sessionId || !clientId) return;

    try {
      await invoke("save_soap_note", {
        sessionId,
        clientId,
        soapNote: { ...soapNote, isDraft: false },
      });
      setState("idle");
      recorderControls.resetRecording();
      setSoapNote(null);
      setSessionId(null);
      setPipeline(null);
      setStatusMessage(null);
    } catch (error) {
      console.error("Failed to save SOAP note:", error);
      alert(
        "Could not save SOAP note: " +
          (error instanceof Error ? error.message : String(error))
      );
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  function mimeTypeToExtension(mimeType: string): string {
    if (mimeType.includes("wav")) return "wav";
    if (mimeType.includes("ogg")) return "ogg";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("webm")) return "webm";
    return "webm";
  }

  const isRecordingUi = state === "recording";

  return (
    <PageShell>
      <PageHeader
        title="Session"
        leading={
          <Button variant="ghost" size="sm" onClick={onBack} aria-label="Back to clients">
            ←
          </Button>
        }
        actions={
          onViewHistory ? (
            <Button variant="outline" size="sm" onClick={onViewHistory}>
              View history
            </Button>
          ) : undefined
        }
      />

      <PageBody>
        {state === "idle" && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <MicIcon className="w-12 h-12 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-medium">Ready to record</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Start when the session begins. You can pause, then choose what happens when you stop.
              </p>
            </div>
            {statusMessage && (
              <Banner tone="muted" className="max-w-md text-center">
                {statusMessage}
              </Banner>
            )}
            {recorderState.error && (
              <Banner tone="destructive" className="max-w-md text-center">
                {recorderState.error}
              </Banner>
            )}
            <Button size="lg" onClick={startRecording}>
              Start recording
            </Button>
          </div>
        )}

        {isRecordingUi && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div
              className={`w-24 h-24 rounded-full flex items-center justify-center ${
                recorderState.isPaused
                  ? "bg-warning/10"
                  : "bg-destructive/10 animate-pulse"
              }`}
            >
              <div
                className={`w-4 h-4 rounded-full ${
                  recorderState.isPaused ? "bg-warning" : "bg-destructive"
                }`}
              />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-mono font-medium">
                {formatTime(recorderState.duration)}
              </h2>
              <p className="text-sm text-muted-foreground mt-1">
                {recorderState.isPaused ? "Paused" : "Recording…"}
              </p>
            </div>
            {recorderState.error && (
              <Banner tone="destructive" className="max-w-md text-center">
                {recorderState.error}
              </Banner>
            )}
            <ActionRow className="justify-center gap-3">
              {recorderState.canPause && (
                <Button
                  size="lg"
                  variant="outline"
                  onClick={() =>
                    recorderState.isPaused
                      ? recorderControls.resumeRecording()
                      : recorderControls.pauseRecording()
                  }
                >
                  {recorderState.isPaused ? "Resume" : "Pause"}
                </Button>
              )}
              <Button size="lg" variant="destructive" onClick={requestStop}>
                Stop
              </Button>
            </ActionRow>
            <p className="text-xs text-muted-foreground max-w-sm text-center">
              Audio stays on this computer. After Stop you choose: open SOAP notes,
              keep recording, save the audio file, or auto-transcribe and draft SOAP.
            </p>
          </div>
        )}

        {state === "saving" && (
          <LoadingState
            className="h-full"
            label={statusMessage || "Saving session audio…"}
          />
        )}

        {state === "waiting_pipeline" && (
          <div className="max-w-lg mx-auto space-y-6 py-8">
            <div className="text-center space-y-2 py-4">
              <h2 className="text-lg font-medium">Transcribing and drafting SOAP</h2>
              <p className="text-sm text-muted-foreground">
                Local speech-to-text and drafting run on this computer. This can take a few minutes.
              </p>
            </div>
            <SessionPipelineStatusPanel
              status={pipeline}
              loading={pipelineLoading}
              loadError={pipelineError}
              mode="waiting"
              onOpenSetup={onOpenSetup}
              onSpeechToTextReady={() => {
                if (sessionId) void refreshPipeline(sessionId);
                void refreshMlReadiness();
              }}
            />
            <div className="flex flex-col gap-2 items-stretch">
              <Button variant="outline" onClick={() => setState("editing")}>
                Write SOAP notes by hand
              </Button>
              <p className="text-xs text-muted-foreground text-center">
                You can write by hand while jobs finish. A draft will fill empty fields when ready.
              </p>
            </div>
          </div>
        )}

        {state === "editing" && soapNote && (
          <div className="space-y-4 max-w-2xl mx-auto">
            <SessionPipelineStatusPanel
              status={pipeline}
              loading={pipelineLoading}
              loadError={pipelineError}
              mode="editor"
              onOpenSetup={onOpenSetup}
              onSpeechToTextReady={() => {
                if (sessionId) void refreshPipeline(sessionId);
                void refreshMlReadiness();
              }}
            />
            <SoapEditor
              soapNote={soapNote}
              onChange={setSoapNote}
              onSave={saveSoapNote}
              onCancel={() => {
                setState("idle");
                recorderControls.resetRecording();
                setSoapNote(null);
                setSessionId(null);
                setPipeline(null);
              }}
              emptyHint={
                soapFieldsAreEmpty(soapNote)
                  ? "These fields are empty until you type or a local draft arrives."
                  : undefined
              }
            />
          </div>
        )}
      </PageBody>

      {showStopMenu && (
        <StopChoiceDialog
          onChoice={handleStopChoice}
          onDismiss={() => {
            setShowStopMenu(false);
            if (recorderState.isPaused) {
              recorderControls.resumeRecording();
            }
          }}
        />
      )}
    </PageShell>
  );
}

function StopChoiceDialog({
  onChoice,
  onDismiss,
}: {
  onChoice: (choice: StopChoice) => void;
  onDismiss: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div
        role="dialog"
        aria-labelledby="stop-choice-title"
        className="w-full max-w-md rounded-xl border border-border bg-background shadow-lg p-5 space-y-4"
      >
        <div>
          <h2 id="stop-choice-title" className="text-lg font-semibold">
            Recording paused — what next?
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Choose how to finish this session. Clinical audio stays on this computer.
          </p>
        </div>
        <div className="flex flex-col gap-2">
          <ChoiceButton
            title="Go to SOAP notes"
            description="Save the audio and open the note editor (local AI can still draft in the background)."
            onClick={() => onChoice("go_soap")}
          />
          <ChoiceButton
            title="Continue recording this session"
            description="Resume where you left off — nothing is finalized yet."
            onClick={() => onChoice("continue")}
          />
          <ChoiceButton
            title="Save the audio file"
            description="Keep a copy you choose, without starting transcription."
            onClick={() => onChoice("save_audio")}
          />
          <ChoiceButton
            title="Transcribe and auto-produce SOAP notes"
            description="Save audio, run local speech-to-text, then draft SOAP when ready."
            onClick={() => onChoice("auto_soap")}
            primary
          />
        </div>
        <Button variant="ghost" className="w-full" onClick={onDismiss}>
          Keep recording (resume)
        </Button>
      </div>
    </div>
  );
}

function ChoiceButton({
  title,
  description,
  onClick,
  primary,
}: {
  title: string;
  description: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={`text-left rounded-lg border px-4 py-3 transition-colors ${
        primary
          ? "border-primary bg-primary/10 hover:bg-primary/15"
          : "border-border hover:bg-accent"
      }`}
    >
      <p className="font-medium text-sm">{title}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
    </button>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

