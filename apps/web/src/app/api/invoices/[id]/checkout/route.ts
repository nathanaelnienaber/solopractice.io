import { NextRequest, NextResponse } from "next/server";
import { db, invoices } from "@/db";
import { eq } from "drizzle-orm";
import {
  createCheckoutSession,
  isStripeConfigured,
  assertNonLiveOrAllowed,
  retrieveAccountOrNull,
} from "@/lib/stripe";
import { deriveConnectStatus } from "@/lib/stripe-connect-status";

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
 *
 * It is also the one route that moves real money, so it carries the same
 * live-mode kill switch as Connect onboarding: with a live (or
 * mode-ambiguous `rk_`) secret key and no explicit STRIPE_ALLOW_LIVE_MODE
 * opt-in, the charge path is unreachable. Gating only onboarding was not
 * enough — an account connected before the guard existed would still have
 * left this path able to take real money.
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

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Payments are not available on this environment." },
      { status: 503 },
    );
  }

  // Fail closed on live keys unless explicitly opted in. Checked before any
  // Stripe call so a live deployment cannot even enumerate account state.
  try {
    assertNonLiveOrAllowed();
  } catch (error) {
    console.error(
      "[invoices/checkout] blocked: refusing live-mode charge",
      (error as Error).message,
    );
    return NextResponse.json(
      {
        error:
          "Payments are disabled on this environment pending owner approval.",
        code: "live_mode_blocked",
      },
      { status: 503 },
    );
  }

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;

  try {
    // Verify the destination account can actually take a charge instead of
    // letting Stripe reject it mid-checkout. A stored account id can be stale,
    // restricted, or still pending verification, and the resulting Stripe
    // error surfaces to the client as a generic 500 after they have already
    // committed to paying.
    const account = await retrieveAccountOrNull(
      invoice.therapist.stripeConnectedAccountId,
    );
    const connectStatus = deriveConnectStatus(account);

    if (!connectStatus.canAcceptPayments) {
      console.warn(
        `[invoices/checkout] invoice ${id}: destination account ` +
          `${invoice.therapist.stripeConnectedAccountId} cannot accept ` +
          `payments (status=${connectStatus.status})`,
      );
      // Deliberately generic: the payer is an unauthenticated bearer of an
      // invoice id and is not entitled to the therapist's Stripe verification
      // state. The therapist sees the real reason in their settings page.
      return NextResponse.json(
        {
          error:
            "This practice cannot accept online payments right now. " +
            "Please contact them directly.",
          code: "destination_not_ready",
        },
        { status: 409 },
      );
    }

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
