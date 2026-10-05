import { NextRequest, NextResponse } from "next/server";
import { db, invoices } from "@/db";
import { eq, and } from "drizzle-orm";
import { getSessionTherapist } from "@/lib/auth";
import { sendInvoiceNotification } from "@/lib/email";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/** Draft = first send; sent/viewed = resend the same email without a new invoice. */
const RESENDABLE_STATUSES = new Set(["draft", "sent", "viewed"]);

export async function POST(request: NextRequest, { params }: RouteParams) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const invoice = await db.query.invoices.findFirst({
    where: and(
      eq(invoices.id, id),
      eq(invoices.therapistId, therapist.id)
    ),
    with: {
      client: true,
    },
  });

  if (!invoice) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  if (!RESENDABLE_STATUSES.has(invoice.status)) {
    return NextResponse.json(
      {
        error: `Cannot email an invoice with status "${invoice.status}"`,
      },
      { status: 400 }
    );
  }

  if (!invoice.client?.email) {
    return NextResponse.json(
      { error: "Client has no email address" },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const paymentUrl = `${baseUrl}/client/pay/${invoice.id}`;
  const to = invoice.client.email;

  let emailId: string;
  try {
    const result = await sendInvoiceNotification(
      to,
      invoice.client.firstName,
      `${therapist.firstName} ${therapist.lastName}`,
      invoice.amountCents / 100,
      new Date(invoice.dueDate).toLocaleDateString(),
      paymentUrl
    );
    emailId = result.id;
  } catch (error) {
    console.error("[invoices/send] Resend failed:", error);
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Failed to send invoice email",
      },
      { status: 502 }
    );
  }

  // Mark sent only after Resend accepted the message (with a real id).
  // Resends keep status sent/viewed but refresh sentAt.
  await db
    .update(invoices)
    .set({
      status: invoice.status === "draft" ? "sent" : invoice.status,
      sentAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(invoices.id, id));

  console.info(
    `[invoices/send] Resend accepted id=${emailId} to=${to} invoice=${id}`
  );

  return NextResponse.json({
    success: true,
    paymentUrl,
    to,
    emailId,
  });
}
