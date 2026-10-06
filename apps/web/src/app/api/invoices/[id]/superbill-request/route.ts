/**
 * POST /api/invoices/[id]/superbill-request
 *
 * Client-facing: after an invoice is paid, request a superbill.
 * Stores status + timestamp only — never Dx/CPT/DOB/PDF.
 */

import { NextRequest, NextResponse } from "next/server";
import { db, invoices } from "@/db";
import { eq } from "drizzle-orm";
import { sendSuperbillRequestNotify } from "@/lib/email";
import { validateWebSafeRequest, webSafetyErrorResponse } from "@/lib/web-safety";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  // Reject clinical payloads even though this route needs no body fields.
  if (request.headers.get("content-type")?.includes("application/json")) {
    const validation = await validateWebSafeRequest(request);
    if (!validation.valid) {
      return webSafetyErrorResponse(validation.error);
    }
  }

  const { id } = await params;

  const invoice = await db.query.invoices.findFirst({
    where: eq(invoices.id, id),
    with: {
      client: true,
      therapist: true,
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (invoice.status !== "paid") {
    return NextResponse.json(
      { error: "Superbill can only be requested after payment" },
      { status: 400 }
    );
  }

  if (invoice.superbillRequestStatus === "sent") {
    return NextResponse.json({
      superbillRequestStatus: invoice.superbillRequestStatus,
      superbillRequestedAt: invoice.superbillRequestedAt?.toISOString() ?? null,
      superbillSentAt: invoice.superbillSentAt?.toISOString() ?? null,
      alreadySent: true,
    });
  }

  if (invoice.superbillRequestStatus === "requested") {
    return NextResponse.json({
      superbillRequestStatus: invoice.superbillRequestStatus,
      superbillRequestedAt: invoice.superbillRequestedAt?.toISOString() ?? null,
      superbillSentAt: invoice.superbillSentAt?.toISOString() ?? null,
      alreadyRequested: true,
    });
  }

  const now = new Date();

  await db
    .update(invoices)
    .set({
      superbillRequestStatus: "requested",
      superbillRequestedAt: now,
      updatedAt: now,
    })
    .where(eq(invoices.id, id));

  // Safe ops notify — never Dx/CPT/DOB/PDF. Failures must not undo the request.
  const therapistName =
    invoice.therapist.practiceName ||
    `${invoice.therapist.firstName} ${invoice.therapist.lastName}`;
  const clientName = `${invoice.client.firstName} ${invoice.client.lastName}`;
  const amountDollars = (invoice.amountCents / 100).toFixed(2);
  const paidLabel = invoice.paidAt
    ? invoice.paidAt.toLocaleDateString("en-US")
    : "recently";

  try {
    await sendSuperbillRequestNotify(
      invoice.therapist.email,
      therapistName,
      clientName,
      amountDollars,
      paidLabel,
      invoice.description
    );
  } catch (err) {
    console.error("[superbill-request] therapist notify failed:", err);
  }

  return NextResponse.json({
    superbillRequestStatus: "requested" as const,
    superbillRequestedAt: now.toISOString(),
    superbillSentAt: null,
  });
}
