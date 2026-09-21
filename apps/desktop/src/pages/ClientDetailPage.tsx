import { useParams, Link, useNavigate } from 'react-router-dom';
import { useClientStore, canRecord } from '../stores/clientStore';
import { useSessionStore } from '../stores/sessionStore';
import { format } from 'date-fns';

export function ClientDetailPage() {
  const { clientId } = useParams<{ clientId: string }>();
  const navigate = useNavigate();
  const { clients } = useClientStore();
  const { sessions, addSession } = useSessionStore();

  const client = clients.find((c) => c.id === clientId);

  if (!client) {
    return (
      <div className="card text-center py-12">
        <p className="text-gray-500">Client not found.</p>
        <Link to="/clients" className="btn-primary mt-4 inline-block">
          Back to Clients
        </Link>
      </div>
    );
  }

  const clientSessions = sessions.filter((s) => s.clientLocalId === client.localId);
  const recordingEnabled = canRecord(client);

  const handleStartSession = () => {
    const newSession = {
      localId: Date.now(),
      clientLocalId: client.localId,
      sessionDate: new Date().toISOString(),
      durationMinutes: 45,
      sessionType: 'individual' as const,
      recordingStatus: 'none' as const,
      transcriptStatus: 'none' as const,
      soapStatus: 'none' as const,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    addSession(newSession);
    navigate(`/sessions/${newSession.localId}`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link to="/clients" className="text-gray-500 hover:text-gray-700">
          ← Back
        </Link>
        <h1 className="text-2xl font-bold text-gray-900">
          {client.firstName} {client.lastName}
        </h1>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Contact Information</h2>
          <dl className="space-y-2">
            <div>
              <dt className="text-sm text-gray-500">Email</dt>
              <dd className="text-gray-900">{client.email}</dd>
            </div>
            {client.phone && (
              <div>
                <dt className="text-sm text-gray-500">Phone</dt>
                <dd className="text-gray-900">{client.phone}</dd>
              </div>
            )}
          </dl>
        </div>

        <div className="card">
          <h2 className="text-lg font-semibold mb-4">Consent Status</h2>
          <div className="space-y-2">
            <ConsentRow label="Informed Consent" completed={client.consentStatus.informedConsent} />
            <ConsentRow label="Privacy Notice" completed={client.consentStatus.privacyNotice} />
            <ConsentRow label="Recording Consent" completed={client.consentStatus.recordingConsent} />
            <ConsentRow
              label="Limits of Confidentiality"
              completed={client.consentStatus.limitsOfConfidentiality}
            />
            <ConsentRow label="Telehealth" completed={client.consentStatus.telehealth} />
          </div>
          <p className="text-xs text-gray-500 mt-4">
            Last updated: {format(new Date(client.consentStatus.lastUpdated), 'PPp')}
          </p>
        </div>
      </div>

      <div className="card">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Sessions</h2>
          <button
            onClick={handleStartSession}
            disabled={!recordingEnabled}
            className="btn-primary"
            title={!recordingEnabled ? 'Recording consent required' : undefined}
          >
            Start New Session
          </button>
        </div>

        {!recordingEnabled && (
          <div className="clinical-warning mb-4">
            <strong>Recording Blocked:</strong> Recording consent has not been signed. The client
            must complete consent forms via the web portal before recording is enabled.
          </div>
        )}

        {clientSessions.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No sessions recorded yet.</p>
        ) : (
          <div className="space-y-2">
            {clientSessions
              .sort((a, b) => new Date(b.sessionDate).getTime() - new Date(a.sessionDate).getTime())
              .map((session) => (
                <Link
                  key={session.localId}
                  to={`/sessions/${session.localId}`}
                  className="flex justify-between items-center p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <div>
                    <p className="font-medium text-gray-900">
                      {format(new Date(session.sessionDate), 'PPp')}
                    </p>
                    <p className="text-sm text-gray-500">
                      {session.durationMinutes} min · {session.sessionType}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <StatusBadge label="Audio" status={session.recordingStatus} />
                    <StatusBadge label="Transcript" status={session.transcriptStatus} />
                    <StatusBadge label="SOAP" status={session.soapStatus} />
                  </div>
                </Link>
              ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ConsentRow({ label, completed }: { label: string; completed: boolean }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-700">{label}</span>
      <span
        className={`text-sm px-2 py-0.5 rounded ${
          completed ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-500'
        }`}
      >
        {completed ? '✓ Signed' : 'Pending'}
      </span>
    </div>
  );
}

function StatusBadge({ label, status }: { label: string; status: string }) {
  const colors: Record<string, string> = {
    none: 'bg-gray-100 text-gray-500',
    queued: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    recording: 'bg-red-100 text-red-800',
    completed: 'bg-green-100 text-green-800',
    finalized: 'bg-green-100 text-green-800',
    draft: 'bg-orange-100 text-orange-800',
    failed: 'bg-red-100 text-red-800',
  };

  return (
    <span className={`text-xs px-2 py-0.5 rounded ${colors[status] || colors.none}`}>
      {label}
    </span>
  );
}
