"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { InvoiceCard, type InvoiceCardData } from "@/components/therapist/invoice-card";
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
      <main className="max-w-6xl mx-auto px-4 py-8">
        <p className="text-muted-foreground">{t("common.loading")}</p>
      </main>
    );
  }

  if (notFound || !client) {
    return (
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-4">
        <Link
          href="/therapist/clients"
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          &larr; {t("clients.backToList")}
        </Link>
        <p className="text-muted-foreground">{t("clients.notFound")}</p>
      </main>
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

  return (
    <main className="max-w-6xl mx-auto px-4 py-8 space-y-8">
      <div className="space-y-3">
        <Link
          href="/therapist/clients"
          className="text-sm text-muted-foreground hover:text-foreground inline-block"
        >
          &larr; {t("clients.backToList")}
        </Link>
        <div className="space-y-2">
          <h1 className="text-2xl font-semibold">
            {client.firstName} {client.lastName}
          </h1>
          <p className="text-sm text-muted-foreground">{client.email}</p>
          {client.phone ? (
            <p className="text-sm text-muted-foreground">{client.phone}</p>
          ) : null}
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
          {!client.allConsentsSigned && (
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={sendConsentInvite}
              loading={sendingInvite}
            >
              {t("clients.sendConsentLink")}
            </Button>
          )}
        </div>
      </div>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("clients.appointmentsTitle")}</h2>
          <p className="text-sm text-muted-foreground">
            {t("clients.appointmentsDesc")}
          </p>
        </div>
        <div className="flex flex-col sm:flex-row gap-2">
          <Link
            href={`/therapist/calendar?clientId=${client.id}&new=1`}
            className="sm:flex-1"
          >
            <Button className="w-full">{t("clients.addAppointment")}</Button>
          </Link>
          <Link
            href={`/therapist/calendar?clientId=${client.id}`}
            className="sm:flex-1"
          >
            <Button variant="outline" className="w-full">
              {t("clients.viewAppointments")}
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="p-0">
            {shownAppointments.length === 0 ? (
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
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
                    className="px-4 py-3 flex items-center justify-between gap-3"
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
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("clients.invoicesTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("clients.invoicesDesc")}</p>
        </div>
        <Link href={`/therapist/invoices?clientId=${client.id}`}>
          <Button variant="outline" className="w-full sm:w-auto">
            {t("clients.createInvoice")}
          </Button>
        </Link>
        {invoices.length === 0 ? (
          <Card>
            <CardContent className="p-0">
              <p className="px-4 py-6 text-sm text-muted-foreground text-center">
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
      </section>

      <section className="space-y-3">
        <div className="space-y-1">
          <h2 className="text-lg font-semibold">{t("clients.desktopTitle")}</h2>
          <p className="text-sm text-muted-foreground">{t("clients.desktopDesc")}</p>
        </div>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium">
              {t("clients.desktopHandoffTitle")}
            </CardTitle>
            <CardDescription>{t("clients.desktopHandoffDesc")}</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-col sm:flex-row gap-2">
              <Button className="w-full sm:flex-1" onClick={() => openOnDesktop("session")}>
                {t("clients.openDesktopSession")}
              </Button>
              <Button
                variant="outline"
                className="w-full sm:flex-1"
                onClick={() => openOnDesktop("client")}
              >
                {t("clients.openDesktop")}
              </Button>
            </div>
            {desktopHint ? (
              <p className="text-sm text-muted-foreground">{t("clients.desktopFallback")}</p>
            ) : null}
            <div className="flex flex-col sm:flex-row gap-2">
              <Button variant="outline" className="w-full sm:flex-1" onClick={copyClientId}>
                {copied ? t("clients.copiedId") : t("clients.copyClientId")}
              </Button>
              <Link href="/download" className="sm:flex-1">
                <Button variant="outline" className="w-full">
                  {t("clients.downloadDesktop")}
                </Button>
              </Link>
            </div>
            {!client.recordingConsentSigned ? (
              <p className="text-sm text-muted-foreground">
                {t("clients.desktopRecordingNote")}
              </p>
            ) : null}
          </CardContent>
        </Card>
      </section>
    </main>
  );
}
