import { NextRequest, NextResponse } from "next/server";
import { db, invoices } from "@/db";
import { eq } from "drizzle-orm";
import { createCheckoutSession } from "@/lib/stripe";

interface RouteParams {
  params: Promise<{ id: string }>;
}

/**
 * POST /api/invoices/[id]/checkout
 *
 * Intentionally unauthenticated: clients pay without an account. The invoice
 * id is a nanoid(21) bearer capability delivered by email, so there is no
 * session to scope against here — this is not an ownership bug.
 *
 * It must still refuse invoices the therapist has not sent. Without that
 * guard, anyone holding a draft invoice id could pay it early AND flip its
 * status to "sent" as a side effect, corrupting the therapist's billing state.
 */
export async function POST(request: NextRequest, { params }: RouteParams) {
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

  if (invoice.status === "paid") {
    return NextResponse.json({ error: "Invoice already paid" }, { status: 400 });
  }

  // A draft has not been issued to the client yet; it is not payable.
  if (invoice.status === "draft") {
    return NextResponse.json(
      { error: "Invoice is not available for payment" },
      { status: 404 },
    );
  }

  if (!invoice.therapist.stripeConnectedAccountId) {
    return NextResponse.json(
      { error: "Therapist has not connected Stripe" },
      { status: 400 }
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  try {
    const session = await createCheckoutSession({
      connectedAccountId: invoice.therapist.stripeConnectedAccountId,
      amountCents: invoice.amountCents,
      description: invoice.description,
      clientEmail: invoice.client.email,
      successUrl: `${baseUrl}/client/pay/${id}?success=true`,
      cancelUrl: `${baseUrl}/client/pay/${id}?cancelled=true`,
      invoiceId: id,
    });

    await db
      .update(invoices)
      .set({
        stripeCheckoutSessionId: session.id,
        status: "sent",
        updatedAt: new Date(),
      })
      .where(eq(invoices.id, id));

    return NextResponse.json({ url: session.url });
  } catch (error) {
    console.error("Checkout error:", error);
    return NextResponse.json(
      { error: "Failed to create checkout session" },
      { status: 500 }
    );
  }
}
