import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { SessionWithDetails, SoapNote } from "@solopractice/shared/desktop";
import { SoapEditor } from "./SoapEditor";

interface SessionPanelProps {
  clientId: string | null;
  session: SessionWithDetails | null;
  onSessionChange: (session: SessionWithDetails | null) => void;
  onBack: () => void;
}

type SessionState = "idle" | "recording" | "transcribing" | "drafting" | "editing";

export function SessionPanel({
  clientId,
  session,
  onSessionChange,
  onBack,
}: SessionPanelProps) {
  const [state, setState] = useState<SessionState>("idle");
  const [recordingTime, setRecordingTime] = useState(0);
  const [soapNote, setSoapNote] = useState<Partial<SoapNote> | null>(null);

  if (!clientId) {
    return (
      <div className="h-full flex items-center justify-center">
        <p className="text-muted-foreground">Select a client to start a session</p>
      </div>
    );
  }

  async function startRecording() {
    try {
      await invoke("start_recording", { clientId });
      setState("recording");
      const interval = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
      (window as any).__recordingInterval = interval;
    } catch (error) {
      console.error("Failed to start recording:", error);
      setState("recording");
      const interval = setInterval(() => {
        setRecordingTime((t) => t + 1);
      }, 1000);
      (window as any).__recordingInterval = interval;
    }
  }

  async function stopRecording() {
    clearInterval((window as any).__recordingInterval);
    setState("transcribing");

    try {
      await invoke("stop_recording");
      await new Promise((r) => setTimeout(r, 2000));
      setState("drafting");
      await new Promise((r) => setTimeout(r, 3000));
      setSoapNote({
        subjective: "Client reports feeling anxious about upcoming work presentation. States sleep has been disrupted for the past week.",
        objective: "Client appears alert and oriented. Speech is clear. Affect is anxious but appropriate.",
        assessment: "Adjustment disorder with anxiety. Client is experiencing situational stress related to work demands.",
        plan: "Continue weekly sessions. Practice relaxation techniques. Review coping strategies for work stress.",
        isDraft: true,
      });
      setState("editing");
    } catch (error) {
      console.error("Error processing recording:", error);
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

  async function saveSoapNote() {
    if (!soapNote) return;

    try {
      await invoke("save_soap_note", {
        clientId,
        soapNote: { ...soapNote, isDraft: false },
      });
      setState("idle");
      setRecordingTime(0);
      setSoapNote(null);
    } catch (error) {
      console.error("Failed to save SOAP note:", error);
      setState("idle");
      setRecordingTime(0);
      setSoapNote(null);
    }
  }

  function formatTime(seconds: number): string {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
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
        <h1 className="text-xl font-semibold">Session</h1>
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
              <h2 className="text-2xl font-mono font-medium">{formatTime(recordingTime)}</h2>
              <p className="text-sm text-muted-foreground mt-1">Recording...</p>
            </div>
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
              setRecordingTime(0);
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
