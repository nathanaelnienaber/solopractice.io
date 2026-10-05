import { NextRequest, NextResponse } from "next/server";
import { db, invoices } from "@/db";
import { eq, and } from "drizzle-orm";
import { getSessionTherapist } from "@/lib/auth";
import { sendInvoiceNotification } from "@/lib/email";

interface RouteParams {
  params: Promise<{ id: string }>;
}

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

  if (invoice.status !== "draft") {
    return NextResponse.json(
      { error: "Only draft invoices can be sent" },
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

  try {
    await sendInvoiceNotification(
      invoice.client.email,
      invoice.client.firstName,
      `${therapist.firstName} ${therapist.lastName}`,
      invoice.amountCents / 100,
      new Date(invoice.dueDate).toLocaleDateString(),
      paymentUrl
    );
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

  // Mark sent only after Resend accepted the message.
  await db
    .update(invoices)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(eq(invoices.id, id));

  return NextResponse.json({ success: true, paymentUrl });
}
