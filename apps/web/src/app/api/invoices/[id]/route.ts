import { NextRequest, NextResponse } from "next/server";
import { db, invoices } from "@/db";
import { eq, and } from "drizzle-orm";
import { getSessionTherapist } from "@/lib/auth";
import { validateWebSafeRequest, webSafetyErrorResponse } from "@/lib/web-safety";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * PATCH /api/invoices/[id]
 *
 * Therapist-owned draft edit: amount, description, due date only.
 * Sent / paid / any non-draft invoice is refused.
 */
export async function PATCH(request: NextRequest, { params }: RouteParams) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validation = await validateWebSafeRequest(request);
  if (!validation.valid) {
    return webSafetyErrorResponse(validation.error);
  }

  const { id } = await params;
  const body = validation.body as {
    amountCents?: number;
    description?: string;
    dueDate?: string;
  };

  const hasAmount = body.amountCents !== undefined;
  const hasDescription = body.description !== undefined;
  const hasDueDate = body.dueDate !== undefined;

  if (!hasAmount && !hasDescription && !hasDueDate) {
    return NextResponse.json(
      { error: "Provide amountCents, description, and/or dueDate" },
      { status: 400 }
    );
  }

  if (hasAmount) {
    if (
      typeof body.amountCents !== "number" ||
      !Number.isFinite(body.amountCents) ||
      !Number.isInteger(body.amountCents) ||
      body.amountCents < 1
    ) {
      return NextResponse.json(
        { error: "amountCents must be a positive integer" },
        { status: 400 }
      );
    }
  }

  if (hasDescription) {
    if (
      typeof body.description !== "string" ||
      body.description.trim().length === 0
    ) {
      return NextResponse.json(
        { error: "description must be a non-empty string" },
        { status: 400 }
      );
    }
  }

  let parsedDueDate: Date | undefined;
  if (hasDueDate) {
    if (typeof body.dueDate !== "string" || body.dueDate.trim().length === 0) {
      return NextResponse.json(
        { error: "dueDate must be a date string" },
        { status: 400 }
      );
    }
    parsedDueDate = new Date(body.dueDate);
    if (Number.isNaN(parsedDueDate.getTime())) {
      return NextResponse.json({ error: "Invalid dueDate" }, { status: 400 });
    }
  }

  const existing = await db.query.invoices.findFirst({
    where: and(eq(invoices.id, id), eq(invoices.therapistId, therapist.id)),
  });

  if (!existing) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (existing.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft invoices can be edited" },
      { status: 400 }
    );
  }

  const updates: Partial<typeof invoices.$inferInsert> = {
    updatedAt: new Date(),
  };

  if (hasAmount) {
    updates.amountCents = body.amountCents;
  }
  if (hasDescription) {
    updates.description = body.description!.trim();
  }
  if (parsedDueDate) {
    updates.dueDate = parsedDueDate;
  }

  await db.update(invoices).set(updates).where(eq(invoices.id, id));

  return NextResponse.json({
    invoice: {
      id: existing.id,
      clientId: existing.clientId,
      amountCents: updates.amountCents ?? existing.amountCents,
      description: updates.description ?? existing.description,
      status: existing.status,
      dueDate: (updates.dueDate ?? existing.dueDate).toISOString(),
    },
  });
}
