"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/lib/i18n";
import {
  CALENDAR_HOURS,
  type CalendarView,
  getMonthGridDays,
  getVisibleRange,
  getWeekDays,
  isInVisibleMonth,
  isSameDay,
  shiftAnchor,
} from "@/lib/appointment-calendar";
import { cn } from "@/lib/utils";

interface Appointment {
  id: string;
  clientId: string;
  clientName: string;
  clientEmail: string;
  scheduledAt: string;
  durationMinutes: number;
  status: "scheduled" | "completed" | "cancelled" | "no_show";
  notes: string | null;
  reminderSentAt: string | null;
}

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
}

function formatTime(date: Date, locale: string): string {
  return date.toLocaleTimeString(locale, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateForInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function defaultSlotForDay(day: Date): Date {
  const slot = new Date(day);
  slot.setHours(9, 0, 0, 0);
  return slot;
}

export function AppointmentCalendarPage() {
  const { t, language } = useI18n();
  const router = useRouter();
  const locale = language === "en" ? "en-US" : language;

  const [view, setView] = useState<CalendarView>("week");
  const [anchorDate, setAnchorDate] = useState(() => new Date());
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [newAppointmentDefault, setNewAppointmentDefault] = useState<Date | undefined>();
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);

  const visibleRange = useMemo(
    () => getVisibleRange(view, anchorDate),
    [view, anchorDate]
  );
  const weekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
  const monthDays = useMemo(() => getMonthGridDays(anchorDate), [anchorDate]);
  const today = useMemo(() => new Date(), []);

  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [appointmentsRes, clientsRes] = await Promise.all([
        fetch(
          `/api/appointments?start=${visibleRange.start.toISOString()}&end=${visibleRange.end.toISOString()}`
        ),
        fetch("/api/clients"),
      ]);

      if (appointmentsRes.status === 401 || clientsRes.status === 401) {
        router.push("/therapist/login");
        return;
      }

      const appointmentsData = await appointmentsRes.json();
      const clientsData = await clientsRes.json();

      setAppointments(appointmentsData.appointments || []);
      setClients(clientsData.clients || []);
    } catch {
      setError(t("calendar.loadError"));
    } finally {
      setLoading(false);
    }
  }, [router, t, visibleRange.end, visibleRange.start]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  function openNewAppointment(day?: Date) {
    setNewAppointmentDefault(day ? defaultSlotForDay(day) : undefined);
    setShowNewModal(true);
  }

  function getAppointmentsForDay(day: Date): Appointment[] {
    return appointments
      .filter((apt) => isSameDay(new Date(apt.scheduledAt), day))
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
      );
  }

  async function sendReminder(appointmentId: string) {
    try {
      const res = await fetch(
        `/api/appointments/${appointmentId}/send-reminder`,
        { method: "POST" }
      );
      if (res.ok) {
        loadData();
        alert(t("calendar.reminderSent"));
      } else {
        const data = await res.json();
        alert(data.error || t("calendar.reminderFailed"));
      }
    } catch {
      alert(t("calendar.reminderFailed"));
    }
  }

  const upcomingScheduled = appointments
    .filter(
      (apt) =>
        apt.status === "scheduled" && new Date(apt.scheduledAt) >= today
    )
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );

  return (
    <>
      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div>
          <h1 className="text-2xl font-semibold">{t("calendar.title")}</h1>
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              onClick={() => setAnchorDate(shiftAnchor(view, anchorDate, -1))}
            >
              {t("calendar.previous")}
            </Button>
            <Button variant="outline" onClick={() => setAnchorDate(new Date())}>
              {t("calendar.today")}
            </Button>
            <Button
              variant="outline"
              onClick={() => setAnchorDate(shiftAnchor(view, anchorDate, 1))}
            >
              {t("calendar.next")}
            </Button>
            <span className="text-lg font-medium min-w-[12rem]">
              {visibleRange.label}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-md border border-border p-0.5">
              <Button
                type="button"
                size="sm"
                variant={view === "week" ? "primary" : "ghost"}
                onClick={() => setView("week")}
              >
                {t("calendar.weekView")}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={view === "month" ? "primary" : "ghost"}
                onClick={() => setView("month")}
              >
                {t("calendar.monthView")}
              </Button>
            </div>
            <Dialog
              open={showNewModal}
              onOpenChange={(open) => {
                setShowNewModal(open);
                if (!open) setNewAppointmentDefault(undefined);
              }}
            >
              <DialogTrigger asChild>
                <Button onClick={() => openNewAppointment()}>
                  {t("calendar.newAppointment")}
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>{t("calendar.scheduleTitle")}</DialogTitle>
                  <DialogDescription>
                    {t("calendar.scheduleDesc")}
                  </DialogDescription>
                </DialogHeader>
                <AppointmentForm
                  clients={clients}
                  defaultScheduledAt={newAppointmentDefault}
                  onSave={() => {
                    setShowNewModal(false);
                    setNewAppointmentDefault(undefined);
                    loadData();
                  }}
                  onCancel={() => {
                    setShowNewModal(false);
                    setNewAppointmentDefault(undefined);
                  }}
                />
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">{t("calendar.loading")}</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive">{error}</p>
            <Button onClick={loadData} className="mt-4">
              {t("common.tryAgain")}
            </Button>
          </div>
        ) : view === "week" ? (
          <Card>
            <CardContent className="p-0 overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="grid grid-cols-8 border-b border-border">
                  <div className="p-2 border-r border-border text-sm text-muted-foreground">
                    {t("calendar.time")}
                  </div>
                  {weekDays.map((day, i) => (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "p-2 text-center text-sm",
                        isSameDay(day, today) && "bg-primary/10 font-semibold",
                        i < 6 && "border-r border-border"
                      )}
                    >
                      <div className="font-medium">
                        {day.toLocaleDateString(locale, { weekday: "short" })}
                      </div>
                      <div
                        className={cn(
                          "text-lg",
                          isSameDay(day, today) && "text-primary"
                        )}
                      >
                        {day.getDate()}
                      </div>
                    </div>
                  ))}
                </div>

                {CALENDAR_HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="grid grid-cols-8 border-b border-border last:border-b-0"
                    style={{ minHeight: "60px" }}
                  >
                    <div className="p-2 border-r border-border text-sm text-muted-foreground">
                      {hour > 12 ? hour - 12 : hour}:00{" "}
                      {hour >= 12 ? "PM" : "AM"}
                    </div>
                    {weekDays.map((day, dayIndex) => {
                      const dayAppointments = getAppointmentsForDay(day).filter(
                        (apt) => new Date(apt.scheduledAt).getHours() === hour
                      );

                      return (
                        <div
                          key={`${day.toISOString()}-${hour}`}
                          className={cn(
                            "p-1",
                            dayIndex < 6 && "border-r border-border",
                            isSameDay(day, today) && "bg-primary/5"
                          )}
                        >
                          {dayAppointments.map((apt) => (
                            <AppointmentCard
                              key={apt.id}
                              appointment={apt}
                              locale={locale}
                              onEdit={() => setEditingAppointment(apt)}
                            />
                          ))}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-7 border-b border-border bg-muted/30">
                {[0, 1, 2, 3, 4, 5, 6].map((dow) => (
                  <div
                    key={dow}
                    className="p-2 text-center text-xs font-medium text-muted-foreground border-r border-border last:border-r-0"
                  >
                    {new Date(2026, 0, 4 + dow).toLocaleDateString(locale, {
                      weekday: "short",
                    })}
                  </div>
                ))}
              </div>
              <div className="grid grid-cols-7">
                {monthDays.map((day) => {
                  const dayAppointments = getAppointmentsForDay(day);
                  const inMonth = isInVisibleMonth(day, anchorDate);

                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "min-h-[100px] border-b border-r border-border p-1 flex flex-col",
                        !inMonth && "bg-muted/20 text-muted-foreground",
                        isSameDay(day, today) && "ring-1 ring-inset ring-primary/40"
                      )}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={cn(
                            "text-sm font-medium w-7 h-7 flex items-center justify-center rounded-full",
                            isSameDay(day, today) &&
                              "bg-primary text-primary-foreground"
                          )}
                        >
                          {day.getDate()}
                        </span>
                        {inMonth && (
                          <button
                            type="button"
                            className="text-xs text-muted-foreground hover:text-primary px-1"
                            onClick={() => openNewAppointment(day)}
                            aria-label={t("calendar.addOnDay")}
                          >
                            +
                          </button>
                        )}
                      </div>
                      <div className="space-y-0.5 flex-1 overflow-y-auto max-h-24">
                        {dayAppointments.slice(0, 4).map((apt) => (
                          <AppointmentCard
                            key={apt.id}
                            appointment={apt}
                            locale={locale}
                            compact
                            onEdit={() => setEditingAppointment(apt)}
                          />
                        ))}
                        {dayAppointments.length > 4 && (
                          <p className="text-[10px] text-muted-foreground px-1">
                            {t("calendar.moreCount").replace(
                              "{count}",
                              String(dayAppointments.length - 4)
                            )}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>{t("calendar.upcomingTitle")}</CardTitle>
            <CardDescription>{t("calendar.upcomingDesc")}</CardDescription>
          </CardHeader>
          <CardContent>
            {upcomingScheduled.length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                {t("calendar.noUpcoming")}
              </p>
            ) : (
              <div className="space-y-3">
                {upcomingScheduled.map((apt) => (
                  <div
                    key={apt.id}
                    className="flex items-center justify-between p-3 border rounded-lg gap-4"
                  >
                    <div>
                      <p className="font-medium">{apt.clientName}</p>
                      <p className="text-sm text-muted-foreground">
                        {new Date(apt.scheduledAt).toLocaleDateString(locale, {
                          weekday: "short",
                          month: "short",
                          day: "numeric",
                        })}{" "}
                        {t("calendar.at")}{" "}
                        {formatTime(new Date(apt.scheduledAt), locale)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setEditingAppointment(apt)}
                      >
                        {t("common.edit")}
                      </Button>
                      {apt.reminderSentAt ? (
                        <Badge variant="outline">
                          {t("calendar.reminderSentBadge")}
                        </Badge>
                      ) : (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => sendReminder(apt.id)}
                        >
                          {t("calendar.sendReminder")}
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      <Dialog
        open={!!editingAppointment}
        onOpenChange={(open) => !open && setEditingAppointment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("calendar.editTitle")}</DialogTitle>
            <DialogDescription>{t("calendar.editDesc")}</DialogDescription>
          </DialogHeader>
          {editingAppointment && (
            <AppointmentForm
              clients={clients}
              appointment={editingAppointment}
              onSave={() => {
                setEditingAppointment(null);
                loadData();
              }}
              onCancel={() => setEditingAppointment(null)}
              onDelete={async () => {
                if (confirm(t("calendar.deleteConfirm"))) {
                  await fetch(`/api/appointments/${editingAppointment.id}`, {
                    method: "DELETE",
                  });
                  setEditingAppointment(null);
                  loadData();
                }
              }}
            />
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}

function AppointmentCard({
  appointment,
  locale,
  compact,
  onEdit,
}: {
  appointment: Appointment;
  locale: string;
  compact?: boolean;
  onEdit: () => void;
}) {
  const statusColors: Record<string, string> = {
    scheduled:
      "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
    completed:
      "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
    cancelled:
      "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700",
    no_show:
      "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700",
  };

  const time = formatTime(new Date(appointment.scheduledAt), locale);

  return (
    <button
      type="button"
      onClick={onEdit}
      className={cn(
        "w-full text-left rounded border hover:opacity-80 transition-opacity",
        statusColors[appointment.status],
        compact ? "text-[10px] p-1" : "text-xs p-1.5"
      )}
    >
      <div className="font-medium truncate">{appointment.clientName}</div>
      <div className="text-muted-foreground truncate">
        {time} ({appointment.durationMinutes}m)
      </div>
    </button>
  );
}

function AppointmentForm({
  clients,
  appointment,
  defaultScheduledAt,
  onSave,
  onCancel,
  onDelete,
}: {
  clients: Client[];
  appointment?: Appointment;
  defaultScheduledAt?: Date;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const { t } = useI18n();
  const [clientId, setClientId] = useState(appointment?.clientId || "");
  const [scheduledAt, setScheduledAt] = useState(
    appointment?.scheduledAt
      ? formatDateForInput(new Date(appointment.scheduledAt))
      : formatDateForInput(defaultScheduledAt ?? new Date())
  );
  const [durationMinutes, setDurationMinutes] = useState(
    appointment?.durationMinutes?.toString() || "50"
  );
  const [status, setStatus] = useState<
    "scheduled" | "completed" | "cancelled" | "no_show"
  >(appointment?.status || "scheduled");
  const [notes, setNotes] = useState(appointment?.notes || "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!appointment && defaultScheduledAt) {
      setScheduledAt(formatDateForInput(defaultScheduledAt));
    }
  }, [appointment, defaultScheduledAt]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);

    try {
      const url = appointment
        ? `/api/appointments/${appointment.id}`
        : "/api/appointments";
      const method = appointment ? "PATCH" : "POST";

      const body: Record<string, unknown> = {
        scheduledAt: new Date(scheduledAt).toISOString(),
        durationMinutes: parseInt(durationMinutes, 10),
        notes: notes || null,
      };

      if (!appointment) {
        body.clientId = clientId;
      } else {
        body.status = status;
      }

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (res.ok) {
        onSave();
      } else {
        const data = await res.json();
        setError(data.error || t("calendar.saveError"));
      }
    } catch {
      setError(t("calendar.saveError"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!appointment && (
        <div>
          <Label htmlFor="client">{t("calendar.client")}</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder={t("calendar.selectClient")} />
            </SelectTrigger>
            <SelectContent>
              {clients.map((client) => (
                <SelectItem key={client.id} value={client.id}>
                  {client.firstName} {client.lastName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {appointment && (
        <div>
          <Label>{t("calendar.client")}</Label>
          <p className="text-sm text-muted-foreground">
            {appointment.clientName}
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="scheduledAt">{t("calendar.dateTime")}</Label>
        <Input
          id="scheduledAt"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="duration">{t("calendar.duration")}</Label>
        <Select value={durationMinutes} onValueChange={setDurationMinutes}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">{t("calendar.duration30")}</SelectItem>
            <SelectItem value="45">{t("calendar.duration45")}</SelectItem>
            <SelectItem value="50">{t("calendar.duration50")}</SelectItem>
            <SelectItem value="60">{t("calendar.duration60")}</SelectItem>
            <SelectItem value="90">{t("calendar.duration90")}</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {appointment && (
        <div>
          <Label htmlFor="status">{t("calendar.status")}</Label>
          <Select
            value={status}
            onValueChange={(v) =>
              setStatus(
                v as "scheduled" | "completed" | "cancelled" | "no_show"
              )
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">
                {t("calendar.statusScheduled")}
              </SelectItem>
              <SelectItem value="completed">
                {t("calendar.statusCompleted")}
              </SelectItem>
              <SelectItem value="cancelled">
                {t("calendar.statusCancelled")}
              </SelectItem>
              <SelectItem value="no_show">
                {t("calendar.statusNoShow")}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="notes">{t("calendar.notes")}</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={t("calendar.notesPlaceholder")}
          rows={3}
        />
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      <div className="flex gap-2 justify-end">
        {onDelete && (
          <Button
            type="button"
            variant="destructive"
            onClick={onDelete}
            disabled={saving}
          >
            {t("common.delete")}
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel}>
          {t("common.cancel")}
        </Button>
        <Button type="submit" disabled={saving || (!appointment && !clientId)}>
          {saving
            ? t("calendar.saving")
            : appointment
              ? t("common.save")
              : t("calendar.create")}
        </Button>
      </div>
    </form>
  );
}
