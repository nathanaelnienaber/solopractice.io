import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { SoapEditor } from "./SoapEditor";
import type { SoapNote as SharedSoapNote } from "@solopractice/shared/desktop";
import {
  ActionRow,
  Badge,
  Button,
  EmptyState,
  LoadingState,
  PageHeader,
  PageShell,
} from "./ui";

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
  canRecord?: boolean;
  onClose: () => void;
  onStartNewSession: () => void;
}

export function SessionHistory({
  clientId,
  clientName,
  canRecord = true,
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
      return <Badge tone="success">Finalized</Badge>;
    }
    if (session.hasSoapNote && session.soapIsDraft) {
      return <Badge tone="warning">Draft</Badge>;
    }
    if (session.hasTranscript) {
      return <Badge tone="info">Transcribed</Badge>;
    }
    if (session.hasRecording) {
      return <Badge tone="neutral">Recorded</Badge>;
    }
    return <Badge tone="neutral">{session.status}</Badge>;
  }

  return (
    <PageShell>
      <PageHeader
        title="Session History"
        description={clientName}
        leading={
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Back">
            ←
          </Button>
        }
        actions={
          <Button
            onClick={onStartNewSession}
            disabled={!canRecord}
            title={
              canRecord
                ? "Start a new session"
                : "Recording consent required before starting a session"
            }
          >
            + New session
          </Button>
        }
      />

      <div className="flex-1 overflow-hidden flex">
        {/* Session list */}
        <div className="w-1/3 border-r border-border overflow-y-auto">
          {loading ? (
            <LoadingState label="Loading sessions…" />
          ) : error ? (
            <EmptyState title="Could not load sessions" description={error} />
          ) : sessions.length === 0 ? (
            <EmptyState
              title="No sessions yet"
              action={
                <Button onClick={onStartNewSession} disabled={!canRecord}>
                  Start first session
                </Button>
              }
            />
          ) : (
            <div className="divide-y divide-border">
              {sessions.map((session) => (
                <button
                  key={session.id}
                  onClick={() => loadSessionDetails(session.id)}
                  className={`w-full p-4 text-left hover:bg-accent transition-colors ${
                    selectedSession?.session.id === session.id
                      ? "bg-accent"
                      : ""
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-sm">
                      Session {session.id.slice(0, 8)}
                    </span>
                    {getStatusBadge(session)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    {session.hasRecording && <span>Audio</span>}
                    {session.hasTranscript && <span>Transcript</span>}
                    {session.hasSoapNote && <span>SOAP</span>}
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
              onOpenSoapEditor={() => {
                const existing = selectedSession.soapNote;
                setEditingSoap({
                  subjective: existing?.subjective ?? "",
                  objective: existing?.objective ?? "",
                  assessment: existing?.assessment ?? "",
                  plan: existing?.plan ?? "",
                  isDraft: existing?.isDraft ?? true,
                });
                setShowSoapEditor(true);
              }}
              onExportPdf={() => exportSoapPdf(selectedSession.session.id)}
              exportingPdf={exportingPdf === selectedSession.session.id}
            />
          ) : (
            <EmptyState
              className="h-full"
              title="Select a session"
              description="Choose a session from the list to view transcript and SOAP."
            />
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
                sessionId: selectedSession.session.id,
                clientId,
                soapNote: { ...editingSoap, isDraft: false },
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
    </PageShell>
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
          <p className="text-sm text-muted-foreground">
            {session.client.firstName} {session.client.lastName}
          </p>
        </div>
        <ActionRow>
          {session.soapNote && !session.soapNote.isDraft && (
            <Button
              variant="outline"
              size="sm"
              onClick={onExportPdf}
              loading={exportingPdf}
            >
              {exportingPdf ? "Exporting…" : "Export PDF"}
            </Button>
          )}
          <Button size="sm" onClick={onOpenSoapEditor}>
            {session.soapNote ? "Edit SOAP note" : "Create SOAP note"}
          </Button>
        </ActionRow>
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
            <span className="text-xs text-muted-foreground">
              ({session.soapNote.isDraft ? "Draft" : "Finalized"})
            </span>
          )}
        </div>
      </div>

      {/* Transcript Preview */}
      {session.transcript && (
        <div className="space-y-2">
          <h3 className="font-medium">Transcript</h3>
          <div className="p-4 bg-muted/50 rounded-lg max-h-48 overflow-y-auto">
            <p className="text-sm whitespace-pre-wrap font-mono">
              {session.transcript.content.slice(0, 1000)}
              {session.transcript.content.length > 1000 && "..."}
            </p>
          </div>
          {session.transcript.modelUsed && (
            <p className="text-xs text-muted-foreground">
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
            {session.soapNote.isDraft && <Badge tone="warning">Draft</Badge>}
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
        <div className="text-center py-8 text-muted-foreground">
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
    <div className="p-3 bg-muted/50 rounded-lg">
      <h4 className="text-xs font-medium text-muted-foreground mb-1">
        {label}
      </h4>
      <p className="text-sm whitespace-pre-wrap">
        {content.slice(0, 300)}
        {content.length > 300 && "..."}
      </p>
    </div>
  );
}
