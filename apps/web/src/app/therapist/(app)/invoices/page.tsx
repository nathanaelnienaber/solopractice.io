"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  ActionStack,
  PageHeader,
  PageShell,
  touchActionClassName,
  touchStackActionClassName,
} from "@/components/ui/page";
import {
  InvoiceCard,
  type InvoiceCardData,
} from "@/components/therapist/invoice-card";
import { useI18n } from "@/lib/i18n";
import { cn } from "@/lib/utils";

interface Invoice extends InvoiceCardData {
  clientId: string;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
}

// useSearchParams() opts a client component out of static prerendering, so
// Next requires a Suspense boundary above it or the build fails at export.
// The real page lives in InvoicesView below; this wrapper only provides the
// boundary and a sensible loading state.
export default function InvoicesPage() {
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="text-muted-foreground">Loading invoices...</p>
        </PageShell>
      }
    >
      <InvoicesView />
    </Suspense>
  );
}

function InvoicesView() {
  const { t } = useI18n();
  const searchParams = useSearchParams();
  const preselectedClientId = searchParams.get("clientId");

  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateForm, setShowCreateForm] = useState(!!preselectedClientId);

  useEffect(() => {
    Promise.all([fetchInvoices(), fetchClients()]).finally(() =>
      setLoading(false)
    );
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
    <PageShell>
      <PageHeader
        title={t("invoices.title")}
        actions={
          <Button
            className={touchActionClassName}
            onClick={() => setShowCreateForm(true)}
          >
            {t("invoices.create")}
          </Button>
        }
      />

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
        <div className="py-12 text-center text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">No invoices yet</p>
            <Button
              className={touchStackActionClassName}
              onClick={() => setShowCreateForm(true)}
            >
              Create your first invoice
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {invoices.map((invoice) => (
            <InvoiceCard
              key={invoice.id}
              invoice={invoice}
              onUpdate={fetchInvoices}
            />
          ))}
        </div>
      )}

      <Card className="bg-muted/50">
        <CardHeader className="mb-3">
          <CardTitle className="text-base font-medium">What it costs</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            Clients, notes, and the local AI that drafts session notes from
            transcripts are free. Other tools often meter clients — and cloud
            note AI usually runs $20–40+/mo.
          </p>
          <p>
            Our note AI runs on your computer and never goes online. Slower than
            cloud tools, but included.
          </p>
          <p>
            SoloPractice&apos;s only cost is{" "}
            <span className="font-medium text-foreground">1% on payments</span>{" "}
            you collect, plus normal card processing fees. No monthly
            subscription.
          </p>
        </CardContent>
      </Card>
    </PageShell>
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
          Create an invoice and email your client a link to pay
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-medium">Client</label>
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
            placeholder="Therapy session — 50 minutes"
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
          <ActionStack className="sm:flex-row">
            <Button
              type="submit"
              loading={loading}
              className={cn(touchStackActionClassName, "sm:w-auto")}
            >
              Create invoice
            </Button>
            <Button
              type="button"
              variant="outline"
              className={cn(touchStackActionClassName, "sm:w-auto")}
              onClick={onClose}
            >
              Cancel
            </Button>
          </ActionStack>
        </form>
      </CardContent>
    </Card>
  );
}
