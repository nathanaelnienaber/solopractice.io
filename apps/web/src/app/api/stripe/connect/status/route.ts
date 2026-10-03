import { NextResponse } from "next/server";
import { db, therapists } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionTherapist } from "@/lib/auth";
import {
  retrieveAccountOrNull,
  isStripeConfigured,
  getStripeKeyMode,
} from "@/lib/stripe";
import {
  deriveConnectStatus,
  describeConnectStatus,
  describeOutstandingRequirements,
} from "@/lib/stripe-connect-status";

/**
 * GET /api/stripe/connect/status
 *
 * Live Connect status for the session therapist. The settings page renders a
 * server-side snapshot on load; this endpoint exists so the client can re-check
 * after returning from Stripe's hosted flow, where the `account.updated`
 * webhook may not have landed yet.
 *
 * Security note: reads the account id from the session therapist's row only —
 * there is no way to ask about another therapist's account.
 */
export async function GET() {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const accountId = therapist.stripeConnectedAccountId;

  if (!accountId) {
    const snapshot = deriveConnectStatus(null);
    return NextResponse.json({
      ...snapshot,
      copy: describeConnectStatus(snapshot.status),
      outstanding: [],
      mode: getStripeKeyMode(),
      stripeConfigured: isStripeConfigured(),
    });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured on this environment." },
      { status: 503 },
    );
  }

  try {
    const account = await retrieveAccountOrNull(accountId);
    const snapshot = deriveConnectStatus(account);

    // Keep the cached DB flag in step with Stripe's truth. The webhook is the
    // primary path; this is a cheap self-heal for missed or delayed events.
    const shouldBeComplete = snapshot.canAcceptPayments;
    if (account && shouldBeComplete !== therapist.stripeOnboardingComplete) {
      await db
        .update(therapists)
        .set({
          stripeOnboardingComplete: shouldBeComplete,
          updatedAt: new Date(),
        })
        .where(eq(therapists.id, therapist.id));
    }

    return NextResponse.json({
      ...snapshot,
      copy: describeConnectStatus(snapshot.status),
      outstanding: describeOutstandingRequirements(snapshot),
      accountId: account ? accountId : null,
      mode: getStripeKeyMode(),
      stripeConfigured: true,
    });
  } catch (error) {
    console.error("[stripe/connect/status] failed:", error);
    return NextResponse.json(
      { error: "Failed to retrieve Stripe status" },
      { status: 502 },
    );
  }
}
