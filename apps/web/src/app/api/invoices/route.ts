import { NextRequest, NextResponse } from "next/server";
import { db, invoices, clients } from "@/db";
import { eq, and } from "drizzle-orm";
import { getSessionTherapist, generateId } from "@/lib/auth";
import { validateWebSafeRequest, webSafetyErrorResponse } from "@/lib/web-safety";

export async function GET(request: NextRequest) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientId = new URL(request.url).searchParams.get("clientId");

  const invoiceList = await db.query.invoices.findMany({
    where: clientId
      ? and(
          eq(invoices.therapistId, therapist.id),
          eq(invoices.clientId, clientId)
        )
      : eq(invoices.therapistId, therapist.id),
    with: {
      client: true,
    },
    orderBy: (invoices, { desc }) => [desc(invoices.createdAt)],
  });

  return NextResponse.json({
    invoices: invoiceList.map((invoice) => ({
      id: invoice.id,
      clientId: invoice.clientId,
      clientName: `${invoice.client.firstName} ${invoice.client.lastName}`,
      amountCents: invoice.amountCents,
      description: invoice.description,
      status: invoice.status,
      dueDate: invoice.dueDate,
      paidAt: invoice.paidAt,
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

  const { clientId, amountCents, description, dueDate, appointmentId } =
    validation.body as {
      clientId: string;
      amountCents: number;
      description: string;
      dueDate: string;
      appointmentId?: string;
    };

  if (!clientId || !amountCents || !description || !dueDate) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const client = await db.query.clients.findFirst({
    where: and(
      eq(clients.id, clientId),
      eq(clients.therapistId, therapist.id)
    ),
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const invoiceId = generateId();

  await db.insert(invoices).values({
    id: invoiceId,
    clientId,
    therapistId: therapist.id,
    appointmentId,
    amountCents,
    description,
    dueDate: new Date(dueDate),
    status: "draft",
  });

  return NextResponse.json({
    invoice: {
      id: invoiceId,
      clientId,
      amountCents,
      description,
      status: "draft",
      dueDate,
    },
  });
}
