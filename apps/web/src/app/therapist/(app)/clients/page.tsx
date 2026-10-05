"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  allConsentsSigned: boolean;
  recordingConsentSigned: boolean;
  consentsSigned: number;
  consentsRequired: number;
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    fetchClients();
  }, []);

  async function fetchClients() {
    try {
      const res = await fetch("/api/clients");
      if (res.ok) {
        const data = await res.json();
        setClients(data.clients);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-2xl font-semibold">Clients</h1>
        <Button onClick={() => setShowAddForm(true)}>Add Client</Button>
      </div>

        {showAddForm && (
          <AddClientForm
            onClose={() => setShowAddForm(false)}
            onSuccess={() => {
              setShowAddForm(false);
              fetchClients();
            }}
          />
        )}

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : clients.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground mb-4">No clients yet</p>
              <Button onClick={() => setShowAddForm(true)}>Add your first client</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {clients.map((client) => (
              <ClientCard key={client.id} client={client} onUpdate={fetchClients} />
            ))}
          </div>
        )}

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Desktop Integration</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              In the desktop app, clients show &quot;Record blocked&quot; until the
              session recording consent is signed. The desktop app syncs consent
              status from this web portal.
            </p>
          </CardContent>
        </Card>
    </main>
  );
}

function ClientCard({ client, onUpdate }: { client: Client; onUpdate: () => void }) {
  const [sendingInvite, setSendingInvite] = useState(false);

  async function sendConsentInvite() {
    setSendingInvite(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/send-consent-invite`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : "Failed to send invite"
        );
      }
      alert("Consent invite sent!");
      onUpdate();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to send invite");
    } finally {
      setSendingInvite(false);
    }
  }

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium">
              {client.firstName} {client.lastName}
            </h3>
            <p className="text-sm text-muted-foreground">{client.email}</p>
            {client.phone && (
              <p className="text-sm text-muted-foreground">{client.phone}</p>
            )}
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <Badge variant={client.allConsentsSigned ? "success" : "warning"}>
                {client.consentsSigned}/{client.consentsRequired} consents
              </Badge>
              {client.recordingConsentSigned ? (
                <Badge variant="success">Recording OK</Badge>
              ) : (
                <Badge variant="destructive">Recording blocked</Badge>
              )}
            </div>
            <div className="flex gap-2">
              {!client.allConsentsSigned && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={sendConsentInvite}
                  loading={sendingInvite}
                >
                  Send consent link
                </Button>
              )}
              <Link href={`/therapist/invoices?clientId=${client.id}`}>
                <Button variant="outline" size="sm">Create invoice</Button>
              </Link>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function AddClientForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError("");

    const formData = new FormData(e.currentTarget);

    try {
      const res = await fetch("/api/clients", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          firstName: formData.get("firstName"),
          lastName: formData.get("lastName"),
          email: formData.get("email"),
          phone: formData.get("phone") || undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create client");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Add New Client</CardTitle>
        <CardDescription>
          Add a client to send them consent forms and invoices
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <Input
              name="firstName"
              label="First name"
              required
            />
            <Input
              name="lastName"
              label="Last name"
              required
            />
          </div>
          <Input
            name="email"
            type="email"
            label="Email"
            required
          />
          <Input
            name="phone"
            type="tel"
            label="Phone (optional)"
            placeholder="+1 (555) 123-4567"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={loading}>
              Add client
            </Button>
            <Button type="button" variant="outline" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}
