import { NextRequest, NextResponse } from "next/server";
import {
  REMINDER_LEAD_HOURS,
  findAppointmentsDueForAutoReminder,
  sendAndMarkAppointmentReminder,
} from "@/lib/appointment-reminders";
import { isTwilioConfigured } from "@/lib/sms";

/**
 * Vercel Cron: auto-send SMS reminders for appointments within the lead window.
 *
 * Auth: Authorization: Bearer $CRON_SECRET (Vercel sets this when CRON_SECRET
 * is configured on the project).
 *
 * Schedule: daily 14:00 UTC via apps/web/vercel.json crons
 * (Hobby plan allows at most one run/day; Pro can use hourly).
 */

function authorizeCron(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return false;
  }
  const auth = request.headers.get("authorization");
  return auth === `Bearer ${secret}`;
}

export async function GET(request: NextRequest) {
  if (!authorizeCron(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isTwilioConfigured()) {
    console.warn(
      "[cron/appointment-reminders] Twilio not configured — skipping auto reminders (no stub marks)",
    );
    return NextResponse.json({
      ok: true,
      stubMode: true,
      leadHours: REMINDER_LEAD_HOURS,
      sent: 0,
      failed: 0,
      skipped: 0,
      message:
        "Twilio env missing; auto reminders not sent and reminderSentAt left unset",
    });
  }

  const due = await findAppointmentsDueForAutoReminder();
  const results: {
    appointmentId: string;
    status: "sent" | "failed" | "skipped";
    sid?: string;
    error?: string;
  }[] = [];

  for (const row of due) {
    const outcome = await sendAndMarkAppointmentReminder({
      appointmentId: row.appointmentId,
      phone: row.phone,
      clientFirstName: row.clientFirstName,
      therapistFirstName: row.therapistFirstName,
      therapistLastName: row.therapistLastName,
      scheduledAt: new Date(row.scheduledAt),
    });

    if (outcome.ok) {
      results.push({
        appointmentId: row.appointmentId,
        status: "sent",
        sid: outcome.sid,
      });
    } else if (outcome.alreadySent) {
      results.push({
        appointmentId: row.appointmentId,
        status: "skipped",
        error: outcome.error,
      });
    } else {
      results.push({
        appointmentId: row.appointmentId,
        status: "failed",
        error: outcome.error,
      });
    }
  }

  const sent = results.filter((r) => r.status === "sent").length;
  const failed = results.filter((r) => r.status === "failed").length;
  const skipped = results.filter((r) => r.status === "skipped").length;

  console.log(
    `[cron/appointment-reminders] due=${due.length} sent=${sent} failed=${failed} skipped=${skipped}`,
  );

  return NextResponse.json({
    ok: true,
    stubMode: false,
    leadHours: REMINDER_LEAD_HOURS,
    due: due.length,
    sent,
    failed,
    skipped,
    results,
  });
}
