"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";

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

const HOURS = Array.from({ length: 12 }, (_, i) => i + 8); // 8 AM to 7 PM

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatDateForInput(date: Date): string {
  return date.toISOString().slice(0, 16);
}

function getWeekDays(date: Date): Date[] {
  const days: Date[] = [];
  const start = new Date(date);
  start.setDate(start.getDate() - start.getDay()); // Start from Sunday

  for (let i = 0; i < 7; i++) {
    const day = new Date(start);
    day.setDate(start.getDate() + i);
    days.push(day);
  }
  return days;
}

function isSameDay(d1: Date, d2: Date): boolean {
  return (
    d1.getFullYear() === d2.getFullYear() &&
    d1.getMonth() === d2.getMonth() &&
    d1.getDate() === d2.getDate()
  );
}

export default function AppointmentsPage() {
  const { t } = useI18n();
  const router = useRouter();
  const [appointments, setAppointments] = useState<Appointment[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentWeek, setCurrentWeek] = useState(new Date());
  const [showNewModal, setShowNewModal] = useState(false);
  const [editingAppointment, setEditingAppointment] =
    useState<Appointment | null>(null);

  const weekDays = getWeekDays(currentWeek);
  const weekStart = weekDays[0];
  const weekEnd = weekDays[6];

  useEffect(() => {
    loadData();
  }, [currentWeek]);

  async function loadData() {
    setLoading(true);
    setError(null);
    try {
      const [appointmentsRes, clientsRes] = await Promise.all([
        fetch(
          `/api/appointments?start=${weekStart.toISOString()}&end=${weekEnd.toISOString()}`
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
    } catch (err) {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }

  function prevWeek() {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() - 7);
    setCurrentWeek(newDate);
  }

  function nextWeek() {
    const newDate = new Date(currentWeek);
    newDate.setDate(newDate.getDate() + 7);
    setCurrentWeek(newDate);
  }

  function goToToday() {
    setCurrentWeek(new Date());
  }

  function getAppointmentsForDay(day: Date): Appointment[] {
    return appointments.filter((apt) =>
      isSameDay(new Date(apt.scheduledAt), day)
    );
  }

  async function sendReminder(appointmentId: string) {
    try {
      const res = await fetch(
        `/api/appointments/${appointmentId}/send-reminder`,
        {
          method: "POST",
        }
      );
      if (res.ok) {
        loadData();
        alert("Reminder sent successfully!");
      } else {
        const data = await res.json();
        alert(data.error || "Failed to send reminder");
      }
    } catch {
      alert("Failed to send reminder");
    }
  }

  const today = new Date();

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between">
          <div>
            <h1 className="text-xl font-semibold">SoloPractice</h1>
            <p className="text-sm text-muted-foreground">Appointments</p>
          </div>
          <div className="flex items-center gap-4">
            <nav className="flex items-center gap-4">
              <Link
                href="/therapist/dashboard"
                className="text-sm hover:text-primary"
              >
                Dashboard
              </Link>
              <Link
                href="/therapist/clients"
                className="text-sm hover:text-primary"
              >
                Clients
              </Link>
              <Link
                href="/therapist/invoices"
                className="text-sm hover:text-primary"
              >
                Invoices
              </Link>
              <Link
                href="/therapist/settings"
                className="text-sm hover:text-primary"
              >
                Settings
              </Link>
            </nav>
            <LanguageToggle />
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="outline" onClick={prevWeek}>
              &larr; Previous
            </Button>
            <Button variant="outline" onClick={goToToday}>
              Today
            </Button>
            <Button variant="outline" onClick={nextWeek}>
              Next &rarr;
            </Button>
            <span className="text-lg font-medium">
              {weekStart.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              })}{" "}
              -{" "}
              {weekEnd.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
                year: "numeric",
              })}
            </span>
          </div>
          <Dialog open={showNewModal} onOpenChange={setShowNewModal}>
            <DialogTrigger asChild>
              <Button>+ New Appointment</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Schedule Appointment</DialogTitle>
                <DialogDescription>
                  Select a client and time for the new appointment.
                </DialogDescription>
              </DialogHeader>
              <AppointmentForm
                clients={clients}
                onSave={() => {
                  setShowNewModal(false);
                  loadData();
                }}
                onCancel={() => setShowNewModal(false)}
              />
            </DialogContent>
          </Dialog>
        </div>

        {loading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Loading appointments...</p>
          </div>
        ) : error ? (
          <div className="text-center py-12">
            <p className="text-destructive">{error}</p>
            <Button onClick={loadData} className="mt-4">
              Retry
            </Button>
          </div>
        ) : (
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-8 border-b border-border">
                <div className="p-2 border-r border-border text-sm text-muted-foreground">
                  Time
                </div>
                {weekDays.map((day, i) => (
                  <div
                    key={i}
                    className={`p-2 text-center text-sm ${
                      isSameDay(day, today)
                        ? "bg-primary/10 font-semibold"
                        : ""
                    } ${i < 6 ? "border-r border-border" : ""}`}
                  >
                    <div className="font-medium">
                      {day.toLocaleDateString("en-US", { weekday: "short" })}
                    </div>
                    <div
                      className={`text-lg ${isSameDay(day, today) ? "text-primary" : ""}`}
                    >
                      {day.getDate()}
                    </div>
                  </div>
                ))}
              </div>

              {HOURS.map((hour) => (
                <div
                  key={hour}
                  className="grid grid-cols-8 border-b border-border last:border-b-0"
                  style={{ minHeight: "60px" }}
                >
                  <div className="p-2 border-r border-border text-sm text-muted-foreground">
                    {hour > 12 ? hour - 12 : hour}:00 {hour >= 12 ? "PM" : "AM"}
                  </div>
                  {weekDays.map((day, dayIndex) => {
                    const dayAppointments = getAppointmentsForDay(day).filter(
                      (apt) => {
                        const aptHour = new Date(apt.scheduledAt).getHours();
                        return aptHour === hour;
                      }
                    );

                    return (
                      <div
                        key={dayIndex}
                        className={`p-1 ${dayIndex < 6 ? "border-r border-border" : ""} ${
                          isSameDay(day, today) ? "bg-primary/5" : ""
                        }`}
                      >
                        {dayAppointments.map((apt) => (
                          <AppointmentCard
                            key={apt.id}
                            appointment={apt}
                            onEdit={() => setEditingAppointment(apt)}
                            onSendReminder={() => sendReminder(apt.id)}
                            onUpdate={loadData}
                          />
                        ))}
                      </div>
                    );
                  })}
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Upcoming appointments list */}
        <Card>
          <CardHeader>
            <CardTitle>Upcoming Appointments</CardTitle>
            <CardDescription>
              Next 7 days of scheduled appointments
            </CardDescription>
          </CardHeader>
          <CardContent>
            {appointments.filter(
              (apt) =>
                apt.status === "scheduled" &&
                new Date(apt.scheduledAt) >= today
            ).length === 0 ? (
              <p className="text-muted-foreground text-center py-4">
                No upcoming appointments this week
              </p>
            ) : (
              <div className="space-y-3">
                {appointments
                  .filter(
                    (apt) =>
                      apt.status === "scheduled" &&
                      new Date(apt.scheduledAt) >= today
                  )
                  .sort(
                    (a, b) =>
                      new Date(a.scheduledAt).getTime() -
                      new Date(b.scheduledAt).getTime()
                  )
                  .map((apt) => (
                    <div
                      key={apt.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <p className="font-medium">{apt.clientName}</p>
                        <p className="text-sm text-muted-foreground">
                          {new Date(apt.scheduledAt).toLocaleDateString(
                            "en-US",
                            {
                              weekday: "short",
                              month: "short",
                              day: "numeric",
                            }
                          )}{" "}
                          at {formatTime(new Date(apt.scheduledAt))}
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        {apt.reminderSentAt ? (
                          <Badge variant="outline">Reminder sent</Badge>
                        ) : (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => sendReminder(apt.id)}
                          >
                            Send Reminder
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

      {/* Edit Modal */}
      <Dialog
        open={!!editingAppointment}
        onOpenChange={(open) => !open && setEditingAppointment(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Appointment</DialogTitle>
            <DialogDescription>
              Update or cancel this appointment.
            </DialogDescription>
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
                if (
                  confirm("Are you sure you want to delete this appointment?")
                ) {
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
    </div>
  );
}

function AppointmentCard({
  appointment,
  onEdit,
  onSendReminder,
  onUpdate,
}: {
  appointment: Appointment;
  onEdit: () => void;
  onSendReminder: () => void;
  onUpdate: () => void;
}) {
  const statusColors: Record<string, string> = {
    scheduled: "bg-blue-100 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700",
    completed: "bg-green-100 dark:bg-green-900/30 border-green-300 dark:border-green-700",
    cancelled: "bg-red-100 dark:bg-red-900/30 border-red-300 dark:border-red-700",
    no_show: "bg-yellow-100 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700",
  };

  const time = formatTime(new Date(appointment.scheduledAt));

  return (
    <button
      onClick={onEdit}
      className={`w-full text-left text-xs p-1.5 rounded border ${statusColors[appointment.status]} hover:opacity-80 transition-opacity`}
    >
      <div className="font-medium truncate">{appointment.clientName}</div>
      <div className="text-muted-foreground">
        {time} ({appointment.durationMinutes}m)
      </div>
    </button>
  );
}

function AppointmentForm({
  clients,
  appointment,
  onSave,
  onCancel,
  onDelete,
}: {
  clients: Client[];
  appointment?: Appointment;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
}) {
  const [clientId, setClientId] = useState(appointment?.clientId || "");
  const [scheduledAt, setScheduledAt] = useState(
    appointment?.scheduledAt
      ? formatDateForInput(new Date(appointment.scheduledAt))
      : formatDateForInput(new Date())
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
        durationMinutes: parseInt(durationMinutes),
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
        setError(data.error || "Failed to save appointment");
      }
    } catch {
      setError("Failed to save appointment");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {!appointment && (
        <div>
          <Label htmlFor="client">Client</Label>
          <Select value={clientId} onValueChange={setClientId}>
            <SelectTrigger>
              <SelectValue placeholder="Select a client" />
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
          <Label>Client</Label>
          <p className="text-sm text-muted-foreground">
            {appointment.clientName}
          </p>
        </div>
      )}

      <div>
        <Label htmlFor="scheduledAt">Date & Time</Label>
        <Input
          id="scheduledAt"
          type="datetime-local"
          value={scheduledAt}
          onChange={(e) => setScheduledAt(e.target.value)}
          required
        />
      </div>

      <div>
        <Label htmlFor="duration">Duration (minutes)</Label>
        <Select value={durationMinutes} onValueChange={setDurationMinutes}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="30">30 minutes</SelectItem>
            <SelectItem value="45">45 minutes</SelectItem>
            <SelectItem value="50">50 minutes</SelectItem>
            <SelectItem value="60">60 minutes</SelectItem>
            <SelectItem value="90">90 minutes</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {appointment && (
        <div>
          <Label htmlFor="status">Status</Label>
          <Select
            value={status}
            onValueChange={(v) =>
              setStatus(v as "scheduled" | "completed" | "cancelled" | "no_show")
            }
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="scheduled">Scheduled</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="no_show">No Show</SelectItem>
            </SelectContent>
          </Select>
        </div>
      )}

      <div>
        <Label htmlFor="notes">Notes (optional)</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Any notes about this appointment..."
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
            Delete
          </Button>
        )}
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={saving || (!appointment && !clientId)}>
          {saving ? "Saving..." : appointment ? "Update" : "Create"}
        </Button>
      </div>
    </form>
  );
}
