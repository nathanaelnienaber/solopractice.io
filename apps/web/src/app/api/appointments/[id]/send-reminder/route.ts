import { NextRequest, NextResponse } from "next/server";
import { db, appointments, clients, therapists } from "@/db";
import { eq, and } from "drizzle-orm";
import { getSessionTherapist } from "@/lib/auth";
import { sendSms } from "@/lib/sms";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Get appointment with client info
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

  // Format the appointment date/time
  const scheduledDate = new Date(appointment.scheduledAt);
  const dateStr = scheduledDate.toLocaleDateString("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  const timeStr = scheduledDate.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
  });

  // Compose reminder message
  const message = `Hi ${client.firstName}, this is a reminder of your appointment with ${therapist.firstName} ${therapist.lastName} on ${dateStr} at ${timeStr}. Please reply CONFIRM to confirm or call if you need to reschedule.`;

  const smsResult = await sendSms(client.phone, message);

  if (smsResult.success) {
    // Update appointment to record reminder was sent
    await db
      .update(appointments)
      .set({
        reminderSentAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(appointments.id, id));

    return NextResponse.json({
      success: true,
      message: "Reminder sent successfully",
      sid: smsResult.sid,
    });
  } else {
    return NextResponse.json(
      {
        success: false,
        error: smsResult.error || "Failed to send SMS",
      },
      { status: 500 }
    );
  }
}
