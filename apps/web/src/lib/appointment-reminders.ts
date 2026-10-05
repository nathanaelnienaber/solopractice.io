/**
 * Appointment SMS reminders (manual + automatic).
 *
 * Auto schedule: send when the appointment is within REMINDER_LEAD_HOURS of
 * start (default 24). Change REMINDER_LEAD_HOURS to retune.
 * Cron runs daily (14:00 UTC) on Hobby; upgrade to Pro for hourly.
 */

import { and, eq, gt, isNull, lte, inArray, isNotNull } from "drizzle-orm";
import { db, appointments, clients, therapists } from "@/db";
import { isTwilioConfigured, sendSms, type SendSmsResult } from "@/lib/sms";

/** Hours before appointment start when auto SMS should fire. Easy to change. */
export const REMINDER_LEAD_HOURS = 24;

export const REMINDER_LEAD_MS = REMINDER_LEAD_HOURS * 60 * 60 * 1000;

/** Statuses that still need a client reminder. */
export const REMINDABLE_APPOINTMENT_STATUSES = [
  "scheduled",
  "confirmed",
] as const;

export function formatReminderDateTime(scheduledAt: Date): {
  dateStr: string;
  timeStr: string;
} {
  return {
    dateStr: scheduledAt.toLocaleDateString("en-US", {
      weekday: "long",
      month: "long",
      day: "numeric",
    }),
    timeStr: scheduledAt.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    }),
  };
}

export function buildAppointmentReminderMessage(opts: {
  clientFirstName: string;
  therapistFirstName: string;
  therapistLastName: string;
  scheduledAt: Date;
}): string {
  const { dateStr, timeStr } = formatReminderDateTime(opts.scheduledAt);
  return (
    `Hi ${opts.clientFirstName}, this is a reminder of your appointment with ` +
    `${opts.therapistFirstName} ${opts.therapistLastName} on ${dateStr} at ${timeStr}. ` +
    `Please reply CONFIRM to confirm or call if you need to reschedule.`
  );
}

/**
 * Upper bound of the auto-reminder window: now + lead time.
 * Appointments with scheduledAt in (now, windowEnd] are due for auto SMS.
 */
export function getAutoReminderWindowEnd(now: Date = new Date()): Date {
  return new Date(now.getTime() + REMINDER_LEAD_MS);
}

export type ReminderSendOutcome =
  | { ok: true; sid: string; stub: boolean }
  | { ok: false; error: string; alreadySent?: boolean };

/**
 * Claim reminderSentAt (null → now), send SMS, roll back claim on failure.
 * Prevents double-send when manual and cron race.
 */
export async function sendAndMarkAppointmentReminder(opts: {
  appointmentId: string;
  phone: string;
  clientFirstName: string;
  therapistFirstName: string;
  therapistLastName: string;
  scheduledAt: Date;
}): Promise<ReminderSendOutcome> {
  const claimed = await db
    .update(appointments)
    .set({
      reminderSentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(appointments.id, opts.appointmentId),
        isNull(appointments.reminderSentAt),
      ),
    )
    .returning({ id: appointments.id });

  if (claimed.length === 0) {
    return {
      ok: false,
      error: "Reminder already sent",
      alreadySent: true,
    };
  }

  const body = buildAppointmentReminderMessage({
    clientFirstName: opts.clientFirstName,
    therapistFirstName: opts.therapistFirstName,
    therapistLastName: opts.therapistLastName,
    scheduledAt: opts.scheduledAt,
  });

  const smsResult: SendSmsResult = await sendSms({ to: opts.phone, body });

  if (!smsResult.success) {
    await db
      .update(appointments)
      .set({
        reminderSentAt: null,
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, opts.appointmentId));

    return {
      ok: false,
      error: smsResult.error || "Failed to send SMS",
    };
  }

  return {
    ok: true,
    sid: smsResult.sid,
    stub: !isTwilioConfigured(),
  };
}

export type DueReminderRow = {
  appointmentId: string;
  scheduledAt: Date;
  phone: string;
  clientFirstName: string;
  therapistFirstName: string;
  therapistLastName: string;
};

/**
 * Appointments due for automatic reminder:
 * - reminderSentAt is null
 * - client has a phone
 * - status is scheduled or confirmed
 * - start is after now and within REMINDER_LEAD_HOURS
 */
export async function findAppointmentsDueForAutoReminder(
  now: Date = new Date(),
): Promise<DueReminderRow[]> {
  const windowEnd = getAutoReminderWindowEnd(now);

  const rows = await db
    .select({
      appointmentId: appointments.id,
      scheduledAt: appointments.scheduledAt,
      phone: clients.phone,
      clientFirstName: clients.firstName,
      therapistFirstName: therapists.firstName,
      therapistLastName: therapists.lastName,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .innerJoin(therapists, eq(appointments.therapistId, therapists.id))
    .where(
      and(
        isNull(appointments.reminderSentAt),
        isNotNull(clients.phone),
        inArray(appointments.status, [...REMINDABLE_APPOINTMENT_STATUSES]),
        gt(appointments.scheduledAt, now),
        lte(appointments.scheduledAt, windowEnd),
      ),
    );

  return rows.filter(
    (r): r is DueReminderRow =>
      typeof r.phone === "string" && r.phone.trim().length > 0,
  );
}
