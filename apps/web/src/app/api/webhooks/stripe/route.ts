import { NextRequest, NextResponse } from "next/server";
import { db, invoices, therapists } from "@/db";
import { eq } from "drizzle-orm";
import type Stripe from "stripe";
import { stripe, isStripeConfigured } from "@/lib/stripe";
import { deriveConnectStatus } from "@/lib/stripe-connect-status";

/**
 * POST /api/webhooks/stripe
 *
 * Signature-verified Stripe webhook receiver.
 *
 * Two correctness rules this route exists to enforce:
 *  1. Readiness is DERIVED from the account payload on every event, never
 *     latched. An account that becomes restricted must flip back to not-ready,
 *     otherwise the UI keeps promising payments that Stripe will reject.
 *  2. The therapist row is located by `stripe_connected_account_id`, with
 *     `metadata.therapistId` as a fallback for the window where account
 *     creation succeeded but our DB write did not.
 */

// Stripe needs the raw, unparsed body to verify the signature.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

async function handleAccountUpdated(account: Stripe.Account): Promise<string> {
  const snapshot = deriveConnectStatus(account);
  // `charges_enabled` is the only field that decides whether this account can
  // actually be a destination for a payment, so it is what we persist.
  const ready = snapshot.canAcceptPayments;

  const byAccount = await db
    .update(therapists)
    .set({ stripeOnboardingComplete: ready, updatedAt: new Date() })
    .where(eq(therapists.stripeConnectedAccountId, account.id))
    .returning({ id: therapists.id });

  if (byAccount.length > 0) {
    return `account.updated: therapist ${byAccount[0].id} -> ready=${ready} (status=${snapshot.status})`;
  }

  // Fallback: recover the link we failed to persist at creation time.
  const therapistId = account.metadata?.therapistId;
  if (therapistId) {
    const byMetadata = await db
      .update(therapists)
      .set({
        stripeConnectedAccountId: account.id,
        stripeOnboardingComplete: ready,
        updatedAt: new Date(),
      })
      .where(eq(therapists.id, therapistId))
      .returning({ id: therapists.id });

    if (byMetadata.length > 0) {
      return `account.updated: relinked therapist ${therapistId} to ${account.id} -> ready=${ready}`;
    }
  }

  return `account.updated: no therapist row matched account ${account.id}`;
}

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get("stripe-signature");

  if (!isStripeConfigured()) {
    // 503 (not 400) so Stripe retries once the environment is configured.
    console.error("[stripe webhook] STRIPE_SECRET_KEY not configured");
    return NextResponse.json({ error: "Stripe not configured" }, { status: 503 });
  }

  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Missing signature" }, { status: 400 });
  }

  let event: Stripe.Event;

  try {
    event = stripe.webhooks.constructEvent(
      body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET,
    );
  } catch (err) {
    console.error("Webhook signature verification failed:", err);
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  // Reject cross-mode deliveries outright: a live-mode event arriving at a
  // test-mode deployment (or vice versa) means misconfigured endpoints, and
  // acting on it would corrupt real state.
  const expectedLivemode = !(
    process.env.STRIPE_SECRET_KEY ?? ""
  ).includes("_test_");
  if (event.livemode !== expectedLivemode) {
    console.error(
      `[stripe webhook] mode mismatch: event.livemode=${event.livemode}, ` +
        `expected ${expectedLivemode}. Ignoring ${event.type} (${event.id}).`,
    );
    return NextResponse.json({ received: true, ignored: "mode_mismatch" });
  }

  try {
    switch (event.type) {
      case "checkout.session.completed": {
        const session = event.data.object as Stripe.Checkout.Session;
        const invoiceId = session.metadata?.invoiceId;

        if (invoiceId) {
          await db
            .update(invoices)
            .set({
              status: "paid",
              stripePaymentIntentId:
                typeof session.payment_intent === "string"
                  ? session.payment_intent
                  : session.payment_intent?.id,
              paidAt: new Date(),
              updatedAt: new Date(),
            })
            .where(eq(invoices.id, invoiceId));
          console.log(`[stripe webhook] invoice ${invoiceId} marked paid`);
        }
        break;
      }

      case "account.updated": {
        const account = event.data.object as Stripe.Account;
        console.log(`[stripe webhook] ${await handleAccountUpdated(account)}`);
        break;
      }

      case "capability.updated": {
        // Capability changes (card_payments / transfers) do not always arrive as
        // account.updated. Re-fetch the account so readiness stays accurate.
        const capability = event.data.object as Stripe.Capability;
        const accountId =
          typeof capability.account === "string"
            ? capability.account
            : capability.account?.id;
        if (accountId) {
          const account = await stripe.accounts.retrieve(accountId);
          console.log(
            `[stripe webhook] capability.updated -> ${await handleAccountUpdated(account)}`,
          );
        }
        break;
      }

      case "account.application.deauthorized": {
        // The therapist disconnected us from their Stripe account.
        const accountId = event.account;
        if (accountId) {
          await db
            .update(therapists)
            .set({
              stripeOnboardingComplete: false,
              stripeConnectedAccountId: null,
              updatedAt: new Date(),
            })
            .where(eq(therapists.stripeConnectedAccountId, accountId));
          console.log(`[stripe webhook] deauthorized account ${accountId}`);
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }
  } catch (error) {
    // Return 500 so Stripe retries with backoff rather than dropping the event.
    console.error(
      `[stripe webhook] handler failed for ${event.type} (${event.id}):`,
      error,
    );
    return NextResponse.json(
      { error: "Webhook handler failed" },
      { status: 500 },
    );
  }

  return NextResponse.json({ received: true });
}
