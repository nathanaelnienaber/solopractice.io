import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SoapEditor } from "./SoapEditor";
import type { SoapNote as SharedSoapNote } from "@solopractice/shared/desktop";

interface SessionInfo {
  id: string;
  clientId: string;
  status: string;
  hasRecording: boolean;
  hasTranscript: boolean;
  hasSoapNote: boolean;
  soapIsDraft?: boolean;
}

interface TranscriptData {
  id: string;
  sessionId: string;
  content: string;
  modelUsed: string | null;
  createdAt: string;
}

interface SoapNote {
  id: string | null;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
  isDraft: boolean;
}

interface FullSessionData {
  session: SessionInfo;
  client: {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
  };
  transcript: TranscriptData | null;
  soapNote: SoapNote | null;
}

interface SessionHistoryProps {
  clientId: string;
  clientName: string;
  onClose: () => void;
  onStartNewSession: () => void;
}

export function SessionHistory({
  clientId,
  clientName,
  onClose,
  onStartNewSession,
}: SessionHistoryProps) {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<FullSessionData | null>(null);
  const [showSoapEditor, setShowSoapEditor] = useState(false);
  const [exportingPdf, setExportingPdf] = useState<string | null>(null);
  // Draft being edited in the modal. This is the editor's own (shared) type, not
  // the wire-format SoapNote above: the editor only ever handles the four SOAP
  // fields plus the draft flag, and the id stays unset until the backend assigns it.
  const [editingSoap, setEditingSoap] = useState<Partial<SharedSoapNote>>({});

  useEffect(() => {
    loadSessions();
  }, [clientId]);

  async function loadSessions() {
    setLoading(true);
    setError(null);
    try {
      const result = await invoke<SessionInfo[]>("get_client_sessions", { clientId });
      setSessions(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  async function loadSessionDetails(sessionId: string) {
    try {
      const result = await invoke<FullSessionData | null>("get_full_session", { sessionId });
      setSelectedSession(result);
    } catch (err) {
      console.error("Failed to load session details:", err);
    }
  }

  async function exportSoapPdf(sessionId: string) {
    setExportingPdf(sessionId);
    try {
      const pdfPath = await invoke<string>("export_soap_pdf", { sessionId });
      await invoke("open_superbill_pdf", { path: pdfPath });
    } catch (err) {
      alert("Failed to export PDF: " + (err instanceof Error ? err.message : String(err)));
    } finally {
      setExportingPdf(null);
    }
  }

  function getStatusBadge(session: SessionInfo) {
    if (session.hasSoapNote && !session.soapIsDraft) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300">
          Finalized
        </span>
      );
    }
    if (session.hasSoapNote && session.soapIsDraft) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
          Draft
        </span>
      );
    }
    if (session.hasTranscript) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300">
          Transcribed
        </span>
      );
    }
    if (session.hasRecording) {
      return (
        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300">
          Recorded
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400">
        {session.status}
      </span>
    );
  }

  return (
    <div className="h-full flex flex-col">
      <header className="p-4 border-b border-[var(--border)] flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={onClose}
            className="text-[var(--muted-foreground)] hover:text-[var(--foreground)]"
          >
            &larr;
          </button>
          <div>
            <h1 className="text-xl font-semibold">Session History</h1>
            <p className="text-sm text-[var(--muted-foreground)]">{clientName}</p>
          </div>
        </div>
        <button
          onClick={onStartNewSession}
          className="px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-sm font-medium hover:opacity-90"
        >
          + New Session
        </button>
      </header>

      <div className="flex-1 overflow-hidden flex">
        {/* Session list */}
        <div className="w-1/3 border-r border-[var(--border)] overflow-y-auto">
          {loading ? (
            <div className="p-4 text-center text-[var(--muted-foreground)]">
              Loading sessions...
            </div>
          ) : error ? (
            <div className="p-4 text-center text-[var(--destructive)]">{error}</div>
          ) : sessions.length === 0 ? (
            <div className="p-8 text-center">
              <p className="text-[var(--muted-foreground)]">No sessions yet</p>
              <button
                onClick={onStartNewSession}
                className="mt-4 px-4 py-2 bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg text-sm"
              >
                Start First Session
              </button>
            </div>
          ) : (
            <div className="divide-y divide-[var(--border)]">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadSessionDetails(session.id)}
                  className={`w-full p-4 text-left hover:bg-[var(--accent)] transition-colors ${
                    selectedSession?.session.id === session.id
                      ? "bg-[var(--accent)]"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">
                      Session {session.id.slice(0, 8)}
                    </span>
                    {getStatusBadge(session)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-[var(--muted-foreground)]">
                    {session.hasRecording && <span>🎙️</span>}
                    {session.hasTranscript && <span>📝</span>}
                    {session.hasSoapNote && <span>📋</span>}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Session details */}
        <div className="flex-1 overflow-y-auto">
          {selectedSession ? (
            <SessionDetails
              session={selectedSession}
              onOpenSoapEditor={() => setShowSoapEditor(true)}
              onExportPdf={() => exportSoapPdf(selectedSession.session.id)}
              exportingPdf={exportingPdf === selectedSession.session.id}
            />
          ) : (
            <div className="h-full flex items-center justify-center text-[var(--muted-foreground)]">
              Select a session to view details
            </div>
          )}
        </div>
      </div>

      {/* SOAP Editor Modal */}
      {showSoapEditor && selectedSession && (
        <SoapEditor
          soapNote={editingSoap}
          clientName={clientName}
          onChange={setEditingSoap}
          onSave={async () => {
            try {
              await invoke("save_soap_note", {
                clientId,
                soapNote: editingSoap,
              });
              setShowSoapEditor(false);
              loadSessions();
              loadSessionDetails(selectedSession.session.id);
            } catch (err) {
              setError(err instanceof Error ? err.message : String(err));
            }
          }}
          onCancel={() => {
            setShowSoapEditor(false);
            loadSessionDetails(selectedSession.session.id);
          }}
        />
      )}
    </div>
  );
}

function SessionDetails({
  session,
  onOpenSoapEditor,
  onExportPdf,
  exportingPdf,
}: {
  session: FullSessionData;
  onOpenSoapEditor: () => void;
  onExportPdf: () => void;
  exportingPdf: boolean;
}) {
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">
            Session {session.session.id.slice(0, 8)}
          </h2>
          <p className="text-sm text-[var(--muted-foreground)]">
            {session.client.firstName} {session.client.lastName}
          </p>
        </div>
        <div className="flex gap-2">
          {session.soapNote && !session.soapNote.isDraft && (
            <button
              onClick={onExportPdf}
              disabled={exportingPdf}
              className="px-3 py-1.5 text-sm border border-[var(--border)] rounded-lg hover:bg-[var(--accent)] disabled:opacity-50"
            >
              {exportingPdf ? "Exporting..." : "Export PDF"}
            </button>
          )}
          <button
            onClick={onOpenSoapEditor}
            className="px-3 py-1.5 text-sm bg-[var(--primary)] text-[var(--primary-foreground)] rounded-lg hover:opacity-90"
          >
            {session.soapNote ? "Edit SOAP Note" : "Create SOAP Note"}
          </button>
        </div>
      </div>

      {/* Status */}
      <div className="flex gap-4 text-sm">
        <div className="flex items-center gap-2">
          <span className={session.session.hasRecording ? "text-green-500" : "text-gray-400"}>
            {session.session.hasRecording ? "✓" : "○"}
          </span>
          Recording
        </div>
        <div className="flex items-center gap-2">
          <span className={session.session.hasTranscript ? "text-green-500" : "text-gray-400"}>
            {session.session.hasTranscript ? "✓" : "○"}
          </span>
          Transcript
        </div>
        <div className="flex items-center gap-2">
          <span className={session.session.hasSoapNote ? "text-green-500" : "text-gray-400"}>
            {session.session.hasSoapNote ? "✓" : "○"}
          </span>
          SOAP Note
          {session.soapNote && (
            <span className="text-xs text-[var(--muted-foreground)]">
              ({session.soapNote.isDraft ? "Draft" : "Finalized"})
            </span>
          )}
        </div>
      </div>

      {/* Transcript Preview */}
      {session.transcript && (
        <div className="space-y-2">
          <h3 className="font-medium">Transcript</h3>
          <div className="p-4 bg-[var(--muted)]/50 rounded-lg max-h-48 overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap font-mono">
              {session.transcript.content.slice(0, 1000)}
              {session.transcript.content.length > 1000 && "..."}
            </p>
          </div>
          {session.transcript.modelUsed && (
            <p className="text-xs text-[var(--muted-foreground)]">
              Transcribed with: {session.transcript.modelUsed}
            </p>
          )}
        </div>
      )}

      {/* SOAP Note Preview */}
      {session.soapNote && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <h3 className="font-medium">SOAP Note</h3>
            {session.soapNote.isDraft && (
              <span className="text-xs px-2 py-0.5 rounded bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-300">
                DRAFT
              </span>
            )}
          </div>
          <div className="space-y-3">
            <SoapSection label="S - Subjective" content={session.soapNote.subjective} />
            <SoapSection label="O - Objective" content={session.soapNote.objective} />
            <SoapSection label="A - Assessment" content={session.soapNote.assessment} />
            <SoapSection label="P - Plan" content={session.soapNote.plan} />
          </div>
        </div>
      )}

      {/* No data state */}
      {!session.transcript && !session.soapNote && (
        <div className="text-center py-8 text-[var(--muted-foreground)]">
          <p>No transcript or SOAP note yet.</p>
          <p className="text-sm mt-1">
            {session.session.hasRecording
              ? "Transcription may still be processing."
              : "Start a recording to begin."}
          </p>
        </div>
      )}
    </div>
  );
}

function SoapSection({ label, content }: { label: string; content: string }) {
  if (!content) return null;

  return (
    <div className="p-3 bg-[var(--muted)]/50 rounded-lg">
      <h4 className="text-xs font-medium text-[var(--muted-foreground)] mb-1">
        {label}
      </h4>
      <p className="text-sm whitespace-pre-wrap">
        {content.slice(0, 300)}
        {content.length > 300 && "..."}
      </p>
    </div>
  );
}
