import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { useClientStore, canRecord } from '../stores/clientStore';
import { useJobQueueStore } from '../stores/jobQueueStore';
import { format } from 'date-fns';
import clsx from 'clsx';

export function SessionPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { sessions, updateSession, isRecording, setRecording } = useSessionStore();
  const { clients } = useClientStore();
  const { queueJob } = useJobQueueStore();

  const [recordingTime, setRecordingTime] = useState(0);

  const session = sessions.find((s) => s.localId === Number(sessionId));
  const client = session ? clients.find((c) => c.localId === session.clientLocalId) : null;

  if (!session || !client) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">Session not found.</p>
        <Link to="/clients" className="btn-primary mt-4 inline-block">
          Back to Clients
        </Link>
      </div>
    );
  }

  const recordingEnabled = canRecord(client);

  const handleStartRecording = () => {
    if (!recordingEnabled) return;

    setRecording(true);
    updateSession(session.localId, {
      recordingStatus: 'recording',
      updatedAt: new Date().toISOString(),
    });

    // Simulate recording time counter
    const interval = setInterval(() => {
      setRecordingTime((t) => t + 1);
    }, 1000);

    // Store interval ID for cleanup (in real app, use ref)
    (window as unknown as { recordingInterval: NodeJS.Timeout }).recordingInterval = interval;
  };

  const handleStopRecording = () => {
    setRecording(false);
    clearInterval((window as unknown as { recordingInterval: NodeJS.Timeout }).recordingInterval);

    // Update session status
    updateSession(session.localId, {
      recordingStatus: 'completed',
      audioFilePath: `C:\\Users\\therapist\\recordings\\session_${session.localId}.wav`,
      updatedAt: new Date().toISOString(),
    });

    // Queue transcription job (background, slow OK)
    queueJob({
      type: 'transcript',
      sessionLocalId: session.localId,
      model: 'whisper-base',
    });

    updateSession(session.localId, {
      transcriptStatus: 'queued',
    });
  };

  const handleQueueSOAP = () => {
    if (session.transcriptStatus !== 'completed') return;

    queueJob({
      type: 'soap',
      sessionLocalId: session.localId,
      model: 'ollama-llama3',
    });

    updateSession(session.localId, {
      soapStatus: 'queued',
    });
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to={`/clients/${client.id}`} className="text-gray-500 hover:text-gray-700">
          ← Back to {client.firstName}
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">Session</h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Session Details</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Client</dt>
              <dd className="text-gray-900">
                {client.firstName} {client.lastName}
              </dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Date</dt>
              <dd className="text-gray-900">{format(new Date(session.sessionDate), 'PPp')}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Type</dt>
              <dd className="text-gray-900 capitalize">{session.sessionType}</dd>
            </div>
            <div>
              <dt className="text-sm text-gray-500">Duration</dt>
              <dd className="text-gray-900">{session.durationMinutes} minutes</dd>
            </div>
          </dl>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Recording</h2>

          {!recordingEnabled && (
            <div className="clinical-warning mb-4">
              Recording consent not on file. Recording is blocked until the client signs the
              recording consent via the web portal.
            </div>
          )}

          <div className="flex flex-col items-center gap-4">
            <div
              className={clsx(
                'w-24 h-24 rounded-full flex items-center justify-center text-2xl font-mono',
                {
                  'bg-gray-100 text-gray-400': !isRecording,
                  'bg-red-100 text-red-600 animate-pulse': isRecording,
                }
              )}
            >
              {formatTime(recordingTime)}
            </div>

            {session.recordingStatus === 'none' && (
              <button
                onClick={handleStartRecording}
                disabled={!recordingEnabled}
                className="btn-danger w-full"
              >
                🎤 Start Recording
              </button>
            )}

            {session.recordingStatus === 'recording' && (
              <button onClick={handleStopRecording} className="btn-primary w-full">
                ⏹ Stop Recording
              </button>
            )}

            {session.recordingStatus === 'completed' && (
              <div className="text-center">
                <p className="text-green-600 font-medium">✓ Recording saved</p>
                <p className="text-xs text-gray-500 mt-1">
                  Local file only — never uploaded
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Processing Pipeline</h2>
        <p className="text-sm text-gray-500 mb-4">
          Transcription and SOAP generation run locally in the background. This may take several
          minutes depending on audio length.
        </p>

        <div className="space-y-4">
          <PipelineStep
            label="Audio Recording"
            status={session.recordingStatus}
            description={session.audioFilePath || 'No recording yet'}
          />
          <PipelineStep
            label="Transcription (Whisper)"
            status={session.transcriptStatus}
            description={
              session.transcriptStatus === 'completed'
                ? 'Transcript ready (local only)'
                : 'Queued for local STT processing'
            }
          />
          <PipelineStep
            label="SOAP Draft (Ollama)"
            status={session.soapStatus}
            description={
              session.soapStatus === 'completed' || session.soapStatus === 'draft'
                ? 'Draft ready for review'
                : session.soapStatus === 'finalized'
                  ? 'Finalized'
                  : 'Waiting for transcript'
            }
            action={
              session.transcriptStatus === 'completed' &&
              session.soapStatus === 'none' && (
                <button onClick={handleQueueSOAP} className="btn-secondary text-sm">
                  Generate SOAP
                </button>
              )
            }
          />
        </div>

        {(session.soapStatus === 'draft' || session.soapStatus === 'completed') && (
          <div className="mt-6">
            <button
              onClick={() => navigate(`/sessions/${session.localId}/soap`)}
              className="btn-primary"
            >
              Open SOAP Editor
            </button>
          </div>
        )}
      </div>

      <div className="clinical-warning">
        <strong>Clinical Data Security:</strong> Audio recordings, transcripts, SOAP notes,
        diagnosis codes, and CPT codes are stored only on this device. They are never uploaded to
        the web or any cloud service.
      </div>
    </div>
  );
}

function PipelineStep({
  label,
  status,
  description,
  action,
}: {
  label: string;
  status: string;
  description: string;
  action?: React.ReactNode;
}) {
  const statusColors: Record<string, string> = {
    none: 'bg-gray-200',
    queued: 'bg-yellow-400',
    processing: 'bg-blue-400 animate-pulse',
    recording: 'bg-red-400 animate-pulse',
    completed: 'bg-green-500',
    finalized: 'bg-green-500',
    draft: 'bg-orange-400',
    failed: 'bg-red-500',
  };

  return (
    <div className="flex items-center gap-4">
      <div className={`w-3 h-3 rounded-full ${statusColors[status] || statusColors.none}`} />
      <div className="flex-1">
        <p className="font-medium text-gray-900">{label}</p>
        <p className="text-sm text-gray-500">{description}</p>
      </div>
      {action}
    </div>
  );
}
