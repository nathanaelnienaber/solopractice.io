import { NextRequest, NextResponse } from "next/server";
import { db, appointments, clients } from "@/db";
import { eq, and } from "drizzle-orm";
import { getSessionTherapist } from "@/lib/auth";
import { validateWebSafeRequest, webSafetyErrorResponse } from "@/lib/web-safety";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const appointment = await db
    .select({
      id: appointments.id,
      clientId: appointments.clientId,
      clientFirstName: clients.firstName,
      clientLastName: clients.lastName,
      clientEmail: clients.email,
      scheduledAt: appointments.scheduledAt,
      durationMinutes: appointments.durationMinutes,
      status: appointments.status,
      notes: appointments.notes,
      reminderSentAt: appointments.reminderSentAt,
      createdAt: appointments.createdAt,
    })
    .from(appointments)
    .innerJoin(clients, eq(appointments.clientId, clients.id))
    .where(
      and(eq(appointments.id, id), eq(appointments.therapistId, therapist.id))
    )
    .limit(1);

  if (appointment.length === 0) {
    return NextResponse.json(
      { error: "Appointment not found" },
      { status: 404 }
    );
  }

  const a = appointment[0];
  return NextResponse.json({
    appointment: {
      id: a.id,
      clientId: a.clientId,
      clientName: `${a.clientFirstName} ${a.clientLastName}`,
      clientEmail: a.clientEmail,
      scheduledAt: a.scheduledAt,
      durationMinutes: a.durationMinutes,
      status: a.status,
      notes: a.notes,
      reminderSentAt: a.reminderSentAt,
    },
  });
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validation = await validateWebSafeRequest(request);
  if (!validation.valid) {
    return webSafetyErrorResponse(validation.error);
  }

  const { id } = await params;
  const { scheduledAt, durationMinutes, status, notes } = validation.body as {
    scheduledAt?: string;
    durationMinutes?: number;
    status?: "scheduled" | "completed" | "cancelled" | "no_show";
    notes?: string;
  };

  // Verify appointment belongs to therapist
  const existing = await db.query.appointments.findFirst({
    where: and(
      eq(appointments.id, id),
      eq(appointments.therapistId, therapist.id)
    ),
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Appointment not found" },
      { status: 404 }
    );
  }

  const updates: Partial<typeof appointments.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (scheduledAt) {
    updates.scheduledAt = new Date(scheduledAt);
  }
  if (durationMinutes !== undefined) {
    updates.durationMinutes = durationMinutes;
  }
  if (status) {
    updates.status = status;
  }
  if (notes !== undefined) {
    updates.notes = notes || null;
  }

  await db.update(appointments).set(updates).where(eq(appointments.id, id));

  return NextResponse.json({ success: true });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  // Verify appointment belongs to therapist
  const existing = await db.query.appointments.findFirst({
    where: and(
      eq(appointments.id, id),
      eq(appointments.therapistId, therapist.id)
    ),
  });

  if (!existing) {
    return NextResponse.json(
      { error: "Appointment not found" },
      { status: 404 }
    );
  }

  await db.delete(appointments).where(eq(appointments.id, id));

  return NextResponse.json({ success: true });
}
