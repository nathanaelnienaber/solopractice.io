import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SessionWithDetails, SoapNote } from "@solopractice/shared/desktop";
import { SoapEditor } from "./SoapEditor";
import { useAudioRecorder } from "../hooks/useAudioRecorder";

interface SessionPanelProps {
  clientId: string | null;
  session: SessionWithDetails | null;
  onSessionChange: (session: SessionWithDetails | null) => void;
  onBack: () => void;
  onViewHistory?: () => void;
}

type SessionState = "idle" | "recording" | "transcribing" | "drafting" | "editing";

export function SessionPanel({
  clientId,
  onBack,
  onViewHistory,
}: SessionPanelProps) {
  const [state, setState] = useState<SessionState>("idle");
  const [soapNote, setSoapNote] = useState<Partial<SoapNote> | null>(null);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [recorderState, recorderControls] = useAudioRecorder();

  if (!clientId) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Select a client to start a session</p>
      </div>
    );
  }

  async function startRecording() {
    try {
      const newSessionId = await invoke<string>("start_recording", { clientId });
      setSessionId(newSessionId);
      await recorderControls.startRecording();
      setState("recording");
    } catch (error) {
      console.error("Failed to start recording:", error);
      alert("Could not start recording: " + (error instanceof Error ? error.message : String(error)));
    }
  }

  async function stopRecording() {
    if (!sessionId) {
      console.error("stopRecording called with no active sessionId");
      setState("idle");
      return;
    }
    setState("transcribing");

    try {
      const audioBlob = await recorderControls.stopRecording();
      const audioBytes = new Uint8Array(await audioBlob.arrayBuffer());
      const format = mimeTypeToExtension(audioBlob.type);

      await invoke("save_recording_file", {
        sessionId,
        audioBytes: Array.from(audioBytes), // Tauri IPC serializes Vec<u8> as a JSON array of numbers
        format,
      });
      await invoke("stop_recording", { sessionId });

      // Transcription/drafting job enqueueing lands in Phase 5.
      setState("editing");
      setSoapNote({
        subjective: "",
        objective: "",
        assessment: "",
        plan: "",
        isDraft: true,
      });
    } catch (error) {
      console.error("Error processing recording:", error);
      setSoapNote({ subjective: "", objective: "", assessment: "", plan: "", isDraft: true });
      setState("editing");
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
    } catch (error) {
      console.error("Failed to save SOAP note:", error);
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  }

  // Maps the real MediaRecorder-reported MIME type to a file extension.
  // useAudioRecorder.ts tries several candidates in order (wav, webm/opus,
  // ogg/opus, mp4) since WebKitGTK/Firefox don't support webm for audio
  // recording at all -- whatever MediaRecorder actually accepted is what
  // audioBlob.type reports, which may not be the first candidate tried.
  function mimeTypeToExtension(mimeType: string): string {
    if (mimeType.includes("wav")) return "wav";
    if (mimeType.includes("ogg")) return "ogg";
    if (mimeType.includes("mp4")) return "mp4";
    if (mimeType.includes("webm")) return "webm";
    return "webm"; // last-resort fallback, matches the old default
  }

  return (
    <div className="h-full flex flex-col">
      <header className="p-4 border-b border-border flex items-center gap-4">
        <button
          onClick={onBack}
          className="text-muted-foreground hover:text-foreground"
        >
          &larr;
        </button>
        <h1 className="text-xl font-semibold flex-1">Session</h1>
        {onViewHistory && (
          <button
            onClick={onViewHistory}
            className="text-sm px-3 py-1.5 border border-border rounded-lg hover:bg-accent transition-colors"
          >
            View History
          </button>
        )}
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {state === "idle" && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <MicIcon className="w-12 h-12 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-medium">Ready to Record</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Click to start recording the session
              </p>
            </div>
            {recorderState.error && (
              <div className="max-w-xs text-center text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">
                {recorderState.error}
              </div>
            )}
            <button
              onClick={startRecording}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-medium hover:bg-primary/90 transition-colors"
            >
              Start Recording
            </button>
          </div>
        )}

        {state === "recording" && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-24 h-24 rounded-full bg-destructive/10 flex items-center justify-center animate-pulse">
              <div className="w-4 h-4 rounded-full bg-destructive" />
            </div>
            <div className="text-center">
              <h2 className="text-2xl font-mono font-medium">{formatTime(recorderState.duration)}</h2>
              <p className="text-sm text-muted-foreground mt-1">Recording...</p>
            </div>
            {recorderState.error && (
              <div className="max-w-xs text-center text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-2">
                {recorderState.error}
              </div>
            )}
            <button
              onClick={stopRecording}
              className="px-6 py-3 bg-destructive text-white rounded-lg font-medium hover:bg-destructive/90 transition-colors"
            >
              Stop Recording
            </button>
            <p className="text-xs text-muted-foreground max-w-xs text-center">
              Audio is saved locally. Transcription and SOAP draft will process
              in the background.
            </p>
          </div>
        )}

        {state === "transcribing" && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-24 h-24 rounded-full bg-warning/10 flex items-center justify-center">
              <LoadingSpinner className="w-12 h-12 text-warning" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-medium">Transcribing...</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Processing audio with whisper.cpp
              </p>
            </div>
          </div>
        )}

        {state === "drafting" && (
          <div className="flex flex-col items-center justify-center h-full gap-6">
            <div className="w-24 h-24 rounded-full bg-primary/10 flex items-center justify-center">
              <LoadingSpinner className="w-12 h-12 text-primary" />
            </div>
            <div className="text-center">
              <h2 className="text-lg font-medium">Drafting SOAP Note...</h2>
              <p className="text-sm text-muted-foreground mt-1">
                Generating draft with local LLM
              </p>
            </div>
          </div>
        )}

        {state === "editing" && soapNote && (
          <SoapEditor
            soapNote={soapNote}
            onChange={setSoapNote}
            onSave={saveSoapNote}
            onCancel={() => {
              setState("idle");
              recorderControls.resetRecording();
              setSoapNote(null);
            }}
          />
        )}
      </div>
    </div>
  );
}

function MicIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
  );
}

function LoadingSpinner({ className }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}
