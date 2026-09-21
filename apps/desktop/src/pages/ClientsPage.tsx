import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useClientStore, isClientSelectable, canRecord } from '../stores/clientStore';
import clsx from 'clsx';

export function ClientsPage() {
  const { clients } = useClientStore();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredClients = clients.filter((client) => {
    const query = searchQuery.toLowerCase();
    return (
      client.firstName.toLowerCase().includes(query) ||
      client.lastName.toLowerCase().includes(query) ||
      client.email.toLowerCase().includes(query)
    );
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
        <Link to="/clients/new" className="btn-primary">
          Add Client
        </Link>
      </div>

      <div className="clinical-warning">
        <strong>Note:</strong> Clients without required web consents are greyed out. Recording
        requires explicit recording consent on file.
      </div>

      <div className="card">
        <input
          type="text"
          placeholder="Search clients..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      {filteredClients.length === 0 ? (
        <div className="card text-center py-12">
          <p className="text-gray-500">
            {clients.length === 0
              ? 'No clients yet. Add a client to get started.'
              : 'No clients match your search.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4">
          {filteredClients.map((client) => {
            const selectable = isClientSelectable(client);
            const recordable = canRecord(client);

            return (
              <Link
                key={client.id}
                to={selectable ? `/clients/${client.id}` : '#'}
                className={clsx('card block transition-shadow', {
                  'hover:shadow-lg': selectable,
                  'consent-required pointer-events-none': !selectable,
                })}
              >
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {client.firstName} {client.lastName}
                    </h3>
                    <p className="text-sm text-gray-500">{client.email}</p>
                    {client.phone && <p className="text-sm text-gray-500">{client.phone}</p>}
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    {!selectable && (
                      <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-1 rounded">
                        Consents Required
                      </span>
                    )}
                    {selectable && !recordable && (
                      <span className="text-xs bg-orange-100 text-orange-800 px-2 py-1 rounded">
                        Recording Blocked
                      </span>
                    )}
                    {recordable && (
                      <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                        Recording Enabled
                      </span>
                    )}
                  </div>
                </div>

                <div className="mt-3 flex gap-2 flex-wrap">
                  <ConsentBadge
                    label="Informed"
                    completed={client.consentStatus.informedConsent}
                  />
                  <ConsentBadge
                    label="Privacy"
                    completed={client.consentStatus.privacyNotice}
                  />
                  <ConsentBadge
                    label="Recording"
                    completed={client.consentStatus.recordingConsent}
                  />
                  <ConsentBadge
                    label="Limits"
                    completed={client.consentStatus.limitsOfConfidentiality}
                  />
                  {client.consentStatus.telehealth && (
                    <ConsentBadge label="Telehealth" completed />
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ConsentBadge({ label, completed }: { label: string; completed: boolean }) {
  return (
    <span
      className={clsx('text-xs px-2 py-0.5 rounded', {
        'bg-green-100 text-green-800': completed,
        'bg-gray-100 text-gray-500': !completed,
      })}
    >
      {completed ? '✓' : '○'} {label}
    </span>
  );
}
