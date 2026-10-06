/**
 * Desktop superbill request queue (ops status only).
 *
 * GET  — pending `requested` invoices for the authenticated therapist
 * POST — mark one invoice's superbill request as `sent` (no PDF upload)
 *
 * SECURITY: authenticate via X-Desktop-API-Key; scope all queries by therapist id.
 * Never accept or return Dx/CPT/DOB/PDF bytes.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, invoices } from "@/db";
import { and, eq } from "drizzle-orm";
import { authenticateDesktopRequest } from "@/lib/desktop-auth";
import { validateWebSafeRequest, webSafetyErrorResponse } from "@/lib/web-safety";

function serializeRequest(invoice: {
  id: string;
  clientId: string;
  amountCents: number;
  description: string;
  paidAt: Date | null;
  superbillRequestStatus: string;
  superbillRequestedAt: Date | null;
  superbillSentAt: Date | null;
  client: { firstName: string; lastName: string; email: string };
}) {
  return {
    invoiceId: invoice.id,
    clientId: invoice.clientId,
    clientFirstName: invoice.client.firstName,
    clientLastName: invoice.client.lastName,
    clientEmail: invoice.client.email,
    amountCents: invoice.amountCents,
    description: invoice.description,
    paidAt: invoice.paidAt?.toISOString() ?? null,
    superbillRequestStatus: invoice.superbillRequestStatus,
    superbillRequestedAt: invoice.superbillRequestedAt?.toISOString() ?? null,
    superbillSentAt: invoice.superbillSentAt?.toISOString() ?? null,
  };
}

export async function GET(request: NextRequest) {
  const therapist = await authenticateDesktopRequest(request);
  if (!therapist) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  const statusParam = new URL(request.url).searchParams.get("status");
  const status =
    statusParam === "sent" || statusParam === "none"
      ? statusParam
      : "requested";

  const rows = await db.query.invoices.findMany({
    where: and(
      eq(invoices.therapistId, therapist.id),
      eq(invoices.status, "paid"),
      eq(invoices.superbillRequestStatus, status)
    ),
    with: { client: true },
    orderBy: (inv, { desc }) => [desc(inv.superbillRequestedAt)],
  });

  return NextResponse.json({
    requests: rows.map(serializeRequest),
  });
}

export async function POST(request: NextRequest) {
  const therapist = await authenticateDesktopRequest(request);
  if (!therapist) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  const validation = await validateWebSafeRequest(request);
  if (!validation.valid) {
    return webSafetyErrorResponse(validation.error);
  }

  const body = validation.body as { invoiceId?: string; action?: string };
  const invoiceId = body.invoiceId;
  const action = body.action ?? "mark_sent";

  if (!invoiceId || typeof invoiceId !== "string") {
    return NextResponse.json({ error: "invoiceId is required" }, { status: 400 });
  }

  if (action !== "mark_sent") {
    return NextResponse.json({ error: "Unsupported action" }, { status: 400 });
  }

  const existing = await db.query.invoices.findFirst({
    where: and(
      eq(invoices.id, invoiceId),
      eq(invoices.therapistId, therapist.id)
    ),
    with: { client: true },
  });

  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (existing.status !== "paid") {
    return NextResponse.json(
      { error: "Only paid invoices can mark a superbill sent" },
      { status: 400 }
    );
  }

  if (existing.superbillRequestStatus === "none") {
    return NextResponse.json(
      { error: "No superbill request on this invoice" },
      { status: 400 }
    );
  }

  if (existing.superbillRequestStatus === "sent") {
    return NextResponse.json({
      request: serializeRequest(existing),
      alreadySent: true,
    });
  }

  const now = new Date();
  await db
    .update(invoices)
    .set({
      superbillRequestStatus: "sent",
      superbillSentAt: now,
      updatedAt: now,
    })
    .where(eq(invoices.id, invoiceId));

  return NextResponse.json({
    request: serializeRequest({
      ...existing,
      superbillRequestStatus: "sent",
      superbillSentAt: now,
    }),
  });
}
