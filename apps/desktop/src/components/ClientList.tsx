import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  allConsentsSigned: boolean;
  recordingConsentSigned: boolean;
}

interface ClientListProps {
  selectedClientId: string | null;
  onSelectClient: (id: string) => void;
}

export function ClientList({ selectedClientId, onSelectClient }: ClientListProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const result = await invoke<Client[]>("get_clients");
      setClients(result);
    } catch (error) {
      console.error("Failed to load clients:", error);
      setClients(getMockClients());
    } finally {
      setLoading(false);
    }
  }

  const filteredClients = clients.filter(
    (c) =>
      c.firstName.toLowerCase().includes(search.toLowerCase()) ||
      c.lastName.toLowerCase().includes(search.toLowerCase()) ||
      c.email.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="h-full flex flex-col">
      <header className="p-4 border-b border-border">
        <h1 className="text-xl font-semibold mb-3">Clients</h1>
        <input
          type="text"
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </header>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <div className="text-center text-muted-foreground py-8">Loading...</div>
        ) : filteredClients.length === 0 ? (
          <div className="text-center text-muted-foreground py-8">
            {search ? "No clients match your search" : "No clients yet"}
          </div>
        ) : (
          <div className="space-y-2">
            {filteredClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                selected={client.id === selectedClientId}
                onSelect={() => onSelectClient(client.id)}
              />
            ))}
          </div>
        )}
      </div>

      <div className="p-4 border-t border-border bg-muted/50">
        <p className="text-xs text-muted-foreground">
          Clients sync from web portal. Recording requires all consents signed.
        </p>
      </div>
    </div>
  );
}

function ClientCard({
  client,
  selected,
  onSelect,
}: {
  client: Client;
  selected: boolean;
  onSelect: () => void;
}) {
  const canRecord = client.recordingConsentSigned;

  return (
    <button
      onClick={onSelect}
      disabled={!canRecord}
      className={`
        w-full text-left p-3 rounded-lg border transition-colors
        ${selected ? "border-primary bg-primary/5" : "border-border hover:bg-accent"}
        ${!canRecord ? "opacity-60 cursor-not-allowed" : ""}
      `}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="font-medium">
            {client.firstName} {client.lastName}
          </p>
          <p className="text-sm text-muted-foreground">{client.email}</p>
        </div>
        <div className="flex flex-col items-end gap-1">
          {canRecord ? (
            <span className="text-xs px-2 py-0.5 rounded-full bg-success/10 text-success">
              Ready
            </span>
          ) : (
            <span className="text-xs px-2 py-0.5 rounded-full bg-destructive/10 text-destructive">
              Record blocked
            </span>
          )}
          {!client.allConsentsSigned && (
            <span className="text-xs text-muted-foreground">
              Consents incomplete
            </span>
          )}
        </div>
      </div>
      {!canRecord && (
        <p className="mt-2 text-xs text-muted-foreground">
          Recording consent not signed. Send consent link from web portal.
        </p>
      )}
    </button>
  );
}

function getMockClients(): Client[] {
  return [
    {
      id: "client-1",
      firstName: "Test",
      lastName: "Client",
      email: "test@example.com",
      allConsentsSigned: true,
      recordingConsentSigned: true,
    },
    {
      id: "client-2",
      firstName: "Jane",
      lastName: "Doe",
      email: "jane@example.com",
      allConsentsSigned: false,
      recordingConsentSigned: false,
    },
    {
      id: "client-3",
      firstName: "John",
      lastName: "Smith",
      email: "john@example.com",
      phone: "+1 555 123 4567",
      allConsentsSigned: true,
      recordingConsentSigned: true,
    },
  ];
}
