import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  ActionRow,
  Badge,
  Banner,
  Button,
  EmptyState,
  Input,
  LoadingState,
  PageBody,
  PageFooter,
  PageHeader,
  PageShell,
  Surface,
} from "./ui";

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
  onSelectClient: (id: string, name: string, canRecord: boolean) => void;
  onViewHistory: (id: string, name: string, canRecord: boolean) => void;
}

export function ClientList({
  selectedClientId,
  onSelectClient,
  onViewHistory,
}: ClientListProps) {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showAddClientHelp, setShowAddClientHelp] = useState(false);

  useEffect(() => {
    loadClients();
  }, []);

  async function loadClients() {
    try {
      const result = await invoke<Client[]>("get_clients");
      setClients(result);
    } catch (error) {
      console.error("Failed to load clients:", error);
      setClients([]);
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
    <PageShell>
      <PageHeader
        title="Clients"
        actions={
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowAddClientHelp((v) => !v)}
          >
            {showAddClientHelp ? "Close" : "+ Add Client"}
          </Button>
        }
      >
        {showAddClientHelp && (
          <Banner tone="info" title="Add clients on the web portal">
            <p className="text-muted-foreground">
              New clients are added from the web portal, not here — that&apos;s
              where intake forms and recording consent get signed before a
              session can be recorded.
            </p>
            <p className="text-muted-foreground mt-1">
              Once consent is signed, the client syncs here and shows as{" "}
              <span className="text-success font-medium">Ready</span>.
            </p>
            <ActionRow className="mt-2">
              <Button
                size="sm"
                onClick={() => setShowAddClientHelp(false)}
              >
                Got it
              </Button>
            </ActionRow>
          </Banner>
        )}
        <Input
          type="search"
          placeholder="Search clients…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          aria-label="Search clients"
        />
      </PageHeader>

      <PageBody>
        {loading ? (
          <LoadingState label="Loading clients…" />
        ) : filteredClients.length === 0 ? (
          <EmptyState
            title={search ? "No clients match your search" : "No clients yet"}
            description={
              search
                ? "Try a different name or email."
                : "Connect your account and sync from Settings, or add clients on the web portal."
            }
          />
        ) : (
          <div className="space-y-2">
            {filteredClients.map((client) => (
              <ClientCard
                key={client.id}
                client={client}
                selected={client.id === selectedClientId}
                onSelect={() =>
                  onSelectClient(
                    client.id,
                    `${client.firstName} ${client.lastName}`,
                    client.recordingConsentSigned
                  )
                }
                onViewHistory={() =>
                  onViewHistory(
                    client.id,
                    `${client.firstName} ${client.lastName}`,
                    client.recordingConsentSigned
                  )
                }
              />
            ))}
          </div>
        )}
      </PageBody>

      <PageFooter>
        Clients sync from the web portal. Recording requires signed recording
        consent.
      </PageFooter>
    </PageShell>
  );
}

function ClientCard({
  client,
  selected,
  onSelect,
  onViewHistory,
}: {
  client: Client;
  selected: boolean;
  onSelect: () => void;
  onViewHistory: () => void;
}) {
  const canRecord = client.recordingConsentSigned;

  return (
    <Surface selected={selected} interactive>
      <button
        type="button"
        onClick={onSelect}
        disabled={!canRecord}
        className={`w-full text-left ${!canRecord ? "opacity-60 cursor-not-allowed" : ""}`}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="font-medium">
              {client.firstName} {client.lastName}
            </p>
            <p className="text-sm text-muted-foreground truncate">
              {client.email}
            </p>
          </div>
          <div className="flex flex-col items-end gap-1 shrink-0">
            {canRecord ? (
              <Badge tone="success">Ready</Badge>
            ) : (
              <Badge tone="destructive">Recording blocked</Badge>
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
            Recording consent not signed. Send the consent link from the web
            portal.
          </p>
        )}
      </button>
      <ActionRow className="mt-2">
        <Button variant="outline" size="sm" onClick={onViewHistory}>
          View session history
        </Button>
      </ActionRow>
    </Surface>
  );
}
