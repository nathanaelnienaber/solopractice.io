"use client";

import { Suspense, useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  ActionStack,
  PageHeader,
  PageShell,
  touchActionClassName,
  touchStackActionClassName,
} from "@/components/ui/page";
import { useI18n } from "@/lib/i18n";

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
  return (
    <Suspense
      fallback={
        <PageShell>
          <p className="text-muted-foreground">Loading...</p>
        </PageShell>
      }
    >
      <ClientsView />
    </Suspense>
  );
}

function ClientsView() {
  const { t } = useI18n();
  const router = useRouter();
  const searchParams = useSearchParams();
  const legacyId = searchParams.get("id");

  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    if (legacyId) {
      router.replace(`/therapist/clients/${legacyId}`);
    }
  }, [legacyId, router]);

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

  if (legacyId) {
    return (
      <PageShell>
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </PageShell>
    );
  }

  return (
    <PageShell>
      <PageHeader
        title={t("clients.title")}
        actions={
          <Button
            className={touchActionClassName}
            onClick={() => setShowAddForm(true)}
          >
            {t("clients.addNew")}
          </Button>
        }
      />

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
        <div className="py-12 text-center text-muted-foreground">
          {t("common.loading")}
        </div>
      ) : clients.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="mb-4 text-muted-foreground">{t("clients.noClients")}</p>
            <Button
              className={touchActionClassName}
              onClick={() => setShowAddForm(true)}
            >
              {t("clients.addFirst")}
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="divide-y divide-border overflow-hidden rounded-lg border border-border">
          {clients.map((client) => (
            <ClientRow key={client.id} client={client} />
          ))}
        </div>
      )}
    </PageShell>
  );
}

function ClientRow({ client }: { client: Client }) {
  const { t } = useI18n();

  return (
    <Link
      href={`/therapist/clients/${client.id}`}
      className="flex min-h-14 flex-col gap-2 px-4 py-3 transition-colors hover:bg-muted/50 sm:flex-row sm:items-center sm:justify-between sm:gap-3"
    >
      <div className="min-w-0">
        <p className="truncate font-medium">
          {client.firstName} {client.lastName}
        </p>
        <p className="truncate text-sm text-muted-foreground">{client.email}</p>
      </div>
      <div className="flex flex-shrink-0 flex-wrap items-center gap-1.5 sm:justify-end">
        <Badge variant={client.allConsentsSigned ? "success" : "warning"}>
          {client.consentsSigned}/{client.consentsRequired}
        </Badge>
        {client.recordingConsentSigned ? (
          <Badge variant="success">{t("clients.recordingOk")}</Badge>
        ) : (
          <Badge variant="destructive">{t("clients.recordingBlocked")}</Badge>
        )}
      </div>
    </Link>
  );
}

function AddClientForm({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const { t } = useI18n();
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
      setError(err instanceof Error ? err.message : t("common.error"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t("clients.addFormTitle")}</CardTitle>
        <CardDescription>{t("clients.addFormDesc")}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <Input name="firstName" label={t("clients.firstName")} required />
            <Input name="lastName" label={t("clients.lastName")} required />
          </div>
          <Input name="email" type="email" label={t("clients.email")} required />
          <Input
            name="phone"
            type="tel"
            label={t("clients.phoneOptional")}
            placeholder="+1 (555) 123-4567"
          />
          {error && <p className="text-sm text-destructive">{error}</p>}
          <ActionStack className="sm:flex-row">
            <Button type="submit" loading={loading} className={touchStackActionClassName}>
              {t("clients.addNew")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className={touchStackActionClassName}
              onClick={onClose}
            >
              {t("common.cancel")}
            </Button>
          </ActionStack>
        </form>
      </CardContent>
    </Card>
  );
}
