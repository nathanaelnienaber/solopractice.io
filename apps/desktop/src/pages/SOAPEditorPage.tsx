import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useSessionStore } from '../stores/sessionStore';
import { useClientStore } from '../stores/clientStore';
import type { SOAPNote } from '@solopractice/shared';

export function SOAPEditorPage() {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { sessions, updateSOAPNote, finalizeSOAPNote } = useSessionStore();
  const { clients } = useClientStore();

  const session = sessions.find((s) => s.localId === Number(sessionId));
  const client = session ? clients.find((c) => c.localId === session.clientLocalId) : null;

  const [soap, setSOAP] = useState<SOAPNote>(
    session?.soapNote || {
      subjective: '',
      objective: '',
      assessment: '',
      plan: '',
      finalized: false,
    }
  );

  const [hasChanges, setHasChanges] = useState(false);

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

  const handleChange = (field: keyof SOAPNote, value: string) => {
    if (soap.finalized) return;
    setSOAP((prev) => ({ ...prev, [field]: value }));
    setHasChanges(true);
  };

  const handleSave = () => {
    updateSOAPNote(session.localId, soap);
    setHasChanges(false);
  };

  const handleFinalize = () => {
    if (!confirm('Finalize this SOAP note? You will not be able to edit it after finalizing.')) {
      return;
    }
    const finalizedSOAP = { ...soap, finalized: true, finalizedAt: new Date().toISOString() };
    updateSOAPNote(session.localId, finalizedSOAP);
    finalizeSOAPNote(session.localId);
    setSOAP(finalizedSOAP);
    setHasChanges(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            to={`/sessions/${session.localId}`}
            className="text-gray-500 hover:text-gray-700"
          >
            ← Back to Session
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">SOAP Note</h1>
          {soap.finalized && (
            <span className="bg-green-100 text-green-800 text-sm px-2 py-1 rounded">
              Finalized
            </span>
          )}
        </div>

        {!soap.finalized && (
          <div className="flex gap-2">
            <button
              onClick={handleSave}
              disabled={!hasChanges}
              className="btn-secondary"
            >
              Save Draft
            </button>
            <button onClick={handleFinalize} className="btn-primary">
              Finalize
            </button>
          </div>
        )}
      </div>

      <div className="clinical-warning">
        <strong>CLINICAL DATA — LOCAL ONLY:</strong> This SOAP note is stored exclusively on this
        device. It will never be uploaded to the web or any cloud service.
      </div>

      <div className="card">
        <p className="text-sm text-gray-600 mb-4">
          Client: <strong>{client.firstName} {client.lastName}</strong>
        </p>

        <div className="space-y-6">
          <SOAPSection
            label="S — Subjective"
            description="Patient's reported symptoms, feelings, and concerns"
            value={soap.subjective}
            onChange={(v) => handleChange('subjective', v)}
            disabled={soap.finalized}
          />

          <SOAPSection
            label="O — Objective"
            description="Observable findings, behaviors, and clinical observations"
            value={soap.objective}
            onChange={(v) => handleChange('objective', v)}
            disabled={soap.finalized}
          />

          <SOAPSection
            label="A — Assessment"
            description="Clinical assessment, diagnosis, and analysis"
            value={soap.assessment}
            onChange={(v) => handleChange('assessment', v)}
            disabled={soap.finalized}
          />

          <SOAPSection
            label="P — Plan"
            description="Treatment plan, next steps, and follow-up"
            value={soap.plan}
            onChange={(v) => handleChange('plan', v)}
            disabled={soap.finalized}
          />
        </div>

        {soap.finalized && soap.finalizedAt && (
          <p className="text-xs text-gray-500 mt-6">
            Finalized at: {new Date(soap.finalizedAt).toLocaleString()}
          </p>
        )}
      </div>

      <div className="flex gap-4">
        <button
          onClick={() => navigate(`/sessions/${session.localId}`)}
          className="btn-secondary"
        >
          Back to Session
        </button>

        {soap.finalized && (
          <button
            onClick={() => alert('Generate Superbill — feature coming soon')}
            className="btn-primary"
          >
            Generate Superbill
          </button>
        )}
      </div>
    </div>
  );
}

function SOAPSection({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: string;
  onChange: (value: string) => void;
  disabled: boolean;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-900 mb-1">{label}</label>
      <p className="text-xs text-gray-500 mb-2">{description}</p>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        rows={4}
        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent resize-y disabled:bg-gray-50 disabled:text-gray-600"
        placeholder={disabled ? '' : `Enter ${label.split(' — ')[1].toLowerCase()}...`}
      />
    </div>
  );
}
