import { NextRequest, NextResponse } from "next/server";
import { db, appointments, clients } from "@/db";
import { eq, and } from "drizzle-orm";
import { getSessionTherapist } from "@/lib/auth";
import { sendAndMarkAppointmentReminder } from "@/lib/appointment-reminders";
import { isTwilioConfigured } from "@/lib/sms";

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const result = await db
    .select({
      appointment: appointments,
      client: clients,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .where(
      and(eq(appointments.id, id), eq(appointments.therapistId, therapist.id))
    )
    .limit(1);

  if (result.length === 0) {
    return NextResponse.json(
      { error: "Appointment not found" },
      { status: 404 }
    );
  }

  const { appointment, client } = result[0];

  if (!client.phone) {
    return NextResponse.json(
      { error: "Client has no phone number" },
      { status: 400 }
    );
  }

  const outcome = await sendAndMarkAppointmentReminder({
    appointmentId: id,
    phone: client.phone,
    clientFirstName: client.firstName,
    therapistFirstName: therapist.firstName,
    therapistLastName: therapist.lastName,
    scheduledAt: new Date(appointment.scheduledAt),
  });

  if (!outcome.ok) {
    if (outcome.alreadySent) {
      return NextResponse.json(
        { success: false, error: outcome.error },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { success: false, error: outcome.error },
      { status: 500 }
    );
  }

  return NextResponse.json({
    success: true,
    message: outcome.stub
      ? "Reminder marked sent (Twilio stub — no real SMS)"
      : "Reminder sent successfully",
    sid: outcome.sid,
    stub: outcome.stub || !isTwilioConfigured(),
  });
}
