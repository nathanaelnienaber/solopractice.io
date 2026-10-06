"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InvoiceCard, type InvoiceCardData } from "@/components/therapist/invoice-card";
import {
  ActionStack,
  PageHeader,
  PageSection,
  PageShell,
  touchActionClassName,
  touchStackActionClassName,
} from "@/components/ui/page";
import { useI18n } from "@/lib/i18n";
import {
  desktopClientDeepLink,
  tryOpenDesktopDeepLink,
} from "@/lib/desktop-deep-link";

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string | null;
  allConsentsSigned: boolean;
  recordingConsentSigned: boolean;
  consentsSigned: number;
  consentsRequired: number;
}

interface Appointment {
  id: string;
  scheduledAt: string;
  durationMinutes: number;
  status: string;
}

type Invoice = InvoiceCardData;

function appointmentStatusLabel(status: string, t: (key: string) => string) {
  const map: Record<string, string> = {
    scheduled: t("calendar.statusScheduled"),
    completed: t("calendar.statusCompleted"),
    cancelled: t("calendar.statusCancelled"),
    no_show: t("calendar.statusNoShow"),
    confirmed: t("calendar.statusScheduled"),
  };
  return map[status] || status;
}

export default function ClientDetailPage() {
  const { t, language } = useI18n();
  const params = useParams<{ id: string }>();
  const router = useRouter();
  const clientId = params.id;
  const locale = language === "en" ? "en-US" : language;

  const [client, setClient] = useState<Client | null>(null);
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [sendingInvite, setSendingInvite] = useState(false);
  const [copied, setCopied] = useState(false);
  const [desktopHint, setDesktopHint] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setNotFound(false);
    try {
      const [clientRes, appointmentsRes, invoicesRes] = await Promise.all([
        fetch(`/api/clients/${clientId}`),
        fetch(`/api/appointments?clientId=${encodeURIComponent(clientId)}`),
        fetch(`/api/invoices?clientId=${encodeURIComponent(clientId)}`),
      ]);

      if (clientRes.status === 401) {
        router.push("/therapist/login");
        return;
      }
      if (clientRes.status === 404) {
        setNotFound(true);
        return;
      }
      if (!clientRes.ok) {
        throw new Error("Failed to load client");
      }

      const clientData = await clientRes.json();
      setClient(clientData.client);

      if (appointmentsRes.ok) {
        const data = await appointmentsRes.json();
        setAppointments(data.appointments || []);
      }
      if (invoicesRes.ok) {
        const data = await invoicesRes.json();
        setInvoices(data.invoices || []);
      }
    } finally {
      setLoading(false);
    }
  }, [clientId, router]);

  useEffect(() => {
    load();
  }, [load]);

  async function sendConsentInvite() {
    if (!client) return;
    setSendingInvite(true);
    try {
      const res = await fetch(`/api/clients/${client.id}/send-consent-invite`, {
        method: "POST",
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(
          typeof data.error === "string" ? data.error : t("clients.inviteFailed")
        );
      }
      alert(t("clients.inviteSent"));
      load();
    } catch (err) {
      alert(err instanceof Error ? err.message : t("clients.inviteFailed"));
    } finally {
      setSendingInvite(false);
    }
  }

  async function copyClientId() {
    if (!client) return;
    try {
      await navigator.clipboard.writeText(client.id);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  function openOnDesktop(path: "client" | "session" = "client") {
    if (!client) return;
    tryOpenDesktopDeepLink(desktopClientDeepLink(client.id, path));
    setDesktopHint(true);
  }

  if (loading) {
    return (
      <PageShell>
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </PageShell>
    );
  }

  if (notFound || !client) {
    return (
      <PageShell className="space-y-4">
        <Link
          href="/therapist/clients"
          className="inline-block text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; {t("clients.backToList")}
        </Link>
        <p className="text-muted-foreground">{t("clients.notFound")}</p>
      </PageShell>
    );
  }

  const now = Date.now();
  const upcomingAppointments = appointments
    .filter(
      (a) =>
        new Date(a.scheduledAt).getTime() >= now &&
        a.status !== "cancelled" &&
        a.status !== "no_show"
    )
    .slice(0, 5);
  const recentAppointments = appointments
    .filter((a) => new Date(a.scheduledAt).getTime() < now)
    .slice(0, 5);
  const shownAppointments =
    upcomingAppointments.length > 0 ? upcomingAppointments : recentAppointments;
  const showingPastOnly =
    upcomingAppointments.length === 0 && recentAppointments.length > 0;

  const description = (
    <div className="space-y-2">
      <p>{client.email}</p>
      {client.phone ? <p>{client.phone}</p> : null}
      <div className="flex flex-wrap gap-2 pt-1">
        <Badge variant={client.allConsentsSigned ? "success" : "warning"}>
          {client.consentsSigned}/{client.consentsRequired}{" "}
          {t("clients.consentsLabel")}
        </Badge>
        {client.recordingConsentSigned ? (
          <Badge variant="success">{t("clients.recordingOk")}</Badge>
        ) : (
          <Badge variant="destructive">{t("clients.recordingBlocked")}</Badge>
        )}
      </div>
    </div>
  );

  return (
    <PageShell className="space-y-8">
      <PageHeader
        eyebrow={
          <Link
            href="/therapist/clients"
            className="inline-block text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; {t("clients.backToList")}
          </Link>
        }
        title={`${client.firstName} ${client.lastName}`}
        description={description}
        actions={
          !client.allConsentsSigned ? (
            <Button
              variant="outline"
              className={touchActionClassName}
              onClick={sendConsentInvite}
              loading={sendingInvite}
            >
              {t("clients.sendConsentLink")}
            </Button>
          ) : undefined
        }
      />

      <PageSection
        title={t("clients.appointmentsTitle")}
        description={t("clients.appointmentsDesc")}
      >
        <ActionStack className="sm:flex-row">
          <Link
            href={`/therapist/calendar?clientId=${client.id}&new=1`}
            className="w-full sm:flex-1"
          >
            <Button className={touchStackActionClassName}>
              {t("clients.addAppointment")}
            </Button>
          </Link>
          <Link
            href={`/therapist/calendar?clientId=${client.id}`}
            className="w-full sm:flex-1"
          >
            <Button variant="outline" className={touchStackActionClassName}>
              {t("clients.viewAppointments")}
            </Button>
          </Link>
        </ActionStack>
        <Card>
          <CardContent className="p-0">
            {shownAppointments.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {t("clients.noAppointments")}
              </p>
            ) : (
              <div className="divide-y divide-border">
                {showingPastOnly ? (
                  <p className="px-4 py-2 text-xs text-muted-foreground">
                    {t("clients.recentAppointments")}
                  </p>
                ) : null}
                {shownAppointments.map((appointment) => (
                  <div
                    key={appointment.id}
                    className="flex items-center justify-between gap-3 px-4 py-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium">
                        {new Date(appointment.scheduledAt).toLocaleString(locale, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                          hour: "numeric",
                          minute: "2-digit",
                        })}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {appointment.durationMinutes}m ·{" "}
                        {appointmentStatusLabel(appointment.status, t)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </PageSection>

      <PageSection
        title={t("clients.invoicesTitle")}
        description={t("clients.invoicesDesc")}
        actions={
          <Link href={`/therapist/invoices?clientId=${client.id}`}>
            <Button variant="outline" className={touchActionClassName}>
              {t("clients.createInvoice")}
            </Button>
          </Link>
        }
      >
        {invoices.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                {t("clients.noInvoices")}
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {invoices.map((invoice) => (
              <InvoiceCard
                key={invoice.id}
                invoice={{
                  ...invoice,
                  clientName:
                    invoice.clientName ||
                    `${client.firstName} ${client.lastName}`,
                }}
                onUpdate={load}
              />
            ))}
          </div>
        )}
      </PageSection>

      <PageSection
        title={t("clients.desktopTitle")}
        description={t("clients.desktopDesc")}
      >
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t("clients.desktopHandoffTitle")}
            </CardTitle>
            <CardDescription>{t("clients.desktopHandoffDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <ActionStack className="sm:flex-row">
              <Button
                className={touchStackActionClassName}
                onClick={() => openOnDesktop("session")}
              >
                {t("clients.openDesktopSession")}
              </Button>
              <Button
                variant="outline"
                className={touchStackActionClassName}
                onClick={() => openOnDesktop("client")}
              >
                {t("clients.openDesktop")}
              </Button>
            </ActionStack>
            {desktopHint ? (
              <p className="text-sm text-muted-foreground">{t("clients.desktopFallback")}</p>
            ) : null}
            <ActionStack className="sm:flex-row">
              <Button
                variant="outline"
                className={touchStackActionClassName}
                onClick={copyClientId}
              >
                {copied ? t("clients.copiedId") : t("clients.copyClientId")}
              </Button>
              <Link href="/download" className="w-full sm:flex-1">
                <Button variant="outline" className={touchStackActionClassName}>
                  {t("clients.downloadDesktop")}
                </Button>
              </Link>
            </ActionStack>
            {!client.recordingConsentSigned ? (
              <p className="text-sm text-muted-foreground">
                {t("clients.desktopRecordingNote")}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </PageSection>
    </PageShell>
  );
}
