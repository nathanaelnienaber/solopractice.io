"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface Invoice {
  id: string;
  clientId: string;
  clientName: string;
  amountCents: number;
  description: string;
  status: string;
  dueDate: string;
  paidAt?: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

export default function InvoicesPage() {
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get("clientId");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(!!preselectedClientId);

  useEffect(() => {
    Promise.all([fetchInvoices(), fetchClients()]).finally(() => setLoading(false));
  }, []);

  async function fetchInvoices() {
    const res = await fetch("/api/invoices");
    if (res.ok) {
      const data = await res.json();
      setInvoices(data.invoices);
    }
  }

  async function fetchClients() {
    const res = await fetch("/api/clients");
    if (res.ok) {
      const data = await res.json();
      setClients(data.clients);
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/therapist/dashboard" className="text-muted-foreground hover:text-foreground">
              &larr;
            </Link>
            <h1 className="text-xl font-semibold">Invoices</h1>
          </div>
          <Button onClick={() => setShowCreateForm(true)}>Create Invoice</Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        {showCreateForm && (
          <CreateInvoiceForm
            clients={clients}
            preselectedClientId={preselectedClientId}
            onClose={() => setShowCreateForm(false)}
            onSuccess={() => {
              setShowCreateForm(false);
              fetchInvoices();
            }}
          />
        )}

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading...</div>
        ) : invoices.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <p className="text-muted-foreground mb-4">No invoices yet</p>
              <Button onClick={() => setShowCreateForm(true)}>Create your first invoice</Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {invoices.map((invoice) => (
              <InvoiceCard key={invoice.id} invoice={invoice} onUpdate={fetchInvoices} />
            ))}
          </div>
        )}

        <Card className="bg-muted/50">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Platform Fee</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              SoloPractice charges a 1% platform fee on all payments, in addition to
              Stripe&apos;s standard processing fees. This is the only cost — no monthly subscription.
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function InvoiceCard({ invoice, onUpdate }: { invoice: Invoice; onUpdate: () => void }) {
  const [sending, setSending] = useState(false);

  async function sendInvoice() {
    setSending(true);
    try {
      await fetch(`/api/invoices/${invoice.id}/send`, { method: "POST" });
      onUpdate();
    } finally {
      setSending(false);
    }
  }

  const statusBadge = {
    draft: { variant: "outline" as const, label: "Draft" },
    sent: { variant: "warning" as const, label: "Sent" },
    paid: { variant: "success" as const, label: "Paid" },
    overdue: { variant: "destructive" as const, label: "Overdue" },
    cancelled: { variant: "outline" as const, label: "Cancelled" },
  }[invoice.status] || { variant: "outline" as const, label: invoice.status };

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="font-medium">{invoice.clientName}</h3>
            <p className="text-sm text-muted-foreground">{invoice.description}</p>
            <p className="text-sm text-muted-foreground">
              Due: {new Date(invoice.dueDate).toLocaleDateString()}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <p className="text-xl font-semibold">
              ${(invoice.amountCents / 100).toFixed(2)}
            </p>
            <Badge variant={statusBadge.variant}>{statusBadge.label}</Badge>
            {invoice.status === "draft" && (
              <Button size="sm" onClick={sendInvoice} loading={sending}>
                Send invoice
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function CreateInvoiceForm({
  clients,
  preselectedClientId,
  onClose,
  onSuccess,
}: {
  clients: Client[];
  preselectedClientId: string | null;
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
    const amountDollars = parseFloat(formData.get("amount") as string);

    try {
      const res = await fetch("/api/invoices", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientId: formData.get("clientId"),
          amountCents: Math.round(amountDollars * 100),
          description: formData.get("description"),
          dueDate: formData.get("dueDate"),
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to create invoice");
      }

      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  const defaultDueDate = new Date();
  defaultDueDate.setDate(defaultDueDate.getDate() + 14);

  return (
    <Card>
      <CardHeader>
        <CardTitle>Create Invoice</CardTitle>
        <CardDescription>
          Send an invoice to your client for payment via Stripe
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1.5">Client</label>
            <select
              name="clientId"
              defaultValue={preselectedClientId || ""}
              required
              className="w-full rounded-lg border border-border bg-background px-3 py-2"
            >
              <option value="">Select a client</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.firstName} {client.lastName}
                </option>
              ))}
            </select>
          </div>
          <Input
            name="amount"
            type="number"
            step="0.01"
            min="1"
            label="Amount ($)"
            placeholder="150.00"
            required
          />
          <Input
            name="description"
            label="Description"
            placeholder="Therapy session - 50 minutes"
            required
          />
          <Input
            name="dueDate"
            type="date"
            label="Due date"
            defaultValue={defaultDueDate.toISOString().split("T")[0]}
            required
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <div className="flex gap-2">
            <Button type="submit" loading={loading}>
              Create invoice
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
