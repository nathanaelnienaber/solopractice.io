import { NextRequest, NextResponse } from "next/server";
import { db, appointments, clients } from "@/db";
import { eq, and, gte, lte, desc } from "drizzle-orm";
import { getSessionTherapist, generateId } from "@/lib/auth";
import { validateWebSafeRequest, webSafetyErrorResponse } from "@/lib/web-safety";

export async function GET(request: NextRequest) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const startDate = searchParams.get("start");
  const endDate = searchParams.get("end");
  const clientId = searchParams.get("clientId");

  let query = db
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
    .where(eq(appointments.therapistId, therapist.id))
    .orderBy(desc(appointments.scheduledAt));

  const results = await query;

  // Filter by date range if provided
  let filtered = results;
  if (startDate) {
    const start = new Date(startDate);
    filtered = filtered.filter((a) => new Date(a.scheduledAt) >= start);
  }
  if (endDate) {
    const end = new Date(endDate);
    filtered = filtered.filter((a) => new Date(a.scheduledAt) <= end);
  }
  if (clientId) {
    filtered = filtered.filter((a) => a.clientId === clientId);
  }

  return NextResponse.json({
    appointments: filtered.map((a) => ({
      id: a.id,
      clientId: a.clientId,
      clientName: `${a.clientFirstName} ${a.clientLastName}`,
      clientEmail: a.clientEmail,
      scheduledAt: a.scheduledAt,
      durationMinutes: a.durationMinutes,
      status: a.status,
      notes: a.notes,
      reminderSentAt: a.reminderSentAt,
    })),
  });
}

export async function POST(request: NextRequest) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validation = await validateWebSafeRequest(request);
  if (!validation.valid) {
    return webSafetyErrorResponse(validation.error);
  }

  const { clientId, scheduledAt, durationMinutes, notes } = validation.body as {
    clientId: string;
    scheduledAt: string;
    durationMinutes?: number;
    notes?: string;
  };

  if (!clientId || !scheduledAt) {
    return NextResponse.json(
      { error: "Client and scheduled time are required" },
      { status: 400 }
    );
  }

  // Verify client belongs to therapist
  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, clientId), eq(clients.therapistId, therapist.id)),
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const appointmentId = generateId();
  const scheduledDate = new Date(scheduledAt);

  await db.insert(appointments).values({
    id: appointmentId,
    clientId,
    therapistId: therapist.id,
    scheduledAt: scheduledDate,
    durationMinutes: durationMinutes || 50,
    notes: notes || null,
    status: "scheduled",
  });

  return NextResponse.json({
    appointment: {
      id: appointmentId,
      clientId,
      clientName: `${client.firstName} ${client.lastName}`,
      scheduledAt: scheduledDate,
      durationMinutes: durationMinutes || 50,
      status: "scheduled",
      notes,
    },
  });
}
