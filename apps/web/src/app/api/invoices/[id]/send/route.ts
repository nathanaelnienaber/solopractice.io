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

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const paymentUrl = `${baseUrl}/client/pay/${invoice.id}`;

  await sendInvoiceNotification(
    invoice.client.email,
    invoice.client.firstName,
    `${therapist.firstName} ${therapist.lastName}`,
    invoice.amountCents / 100,
    new Date(invoice.dueDate).toLocaleDateString(),
    paymentUrl
  );

  await db
    .update(invoices)
    .set({ status: "sent", sentAt: new Date(), updatedAt: new Date() })
    .where(eq(invoices.id, id));

  return NextResponse.json({ success: true, paymentUrl });
}
