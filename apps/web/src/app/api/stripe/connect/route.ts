import { NextRequest, NextResponse } from "next/server";
import { db, therapists } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionTherapist } from "@/lib/auth";
import {
  createConnectedAccount,
  createConnectAccountLink,
  retrieveAccountOrNull,
  isStripeConfigured,
  assertNonLiveOrAllowed,
  getStripeKeyMode,
} from "@/lib/stripe";

/**
 * POST /api/stripe/connect
 *
 * Creates (or reuses) the session therapist's Stripe Express account and returns
 * a fresh hosted-onboarding Account Link.
 *
 * Security note: the account id is ALWAYS read from the session therapist's own
 * row. Any `accountId` in the request body is ignored — accepting a client
 * supplied account id here would let one therapist mint onboarding links for
 * another therapist's connected account.
 */
export async function POST(request: NextRequest) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: "Stripe is not configured on this environment." },
      { status: 503 },
    );
  }

  // Fail closed on live keys unless explicitly opted in. Pilot onboarding must
  // not attach a real bank account to a real-money account by default.
  try {
    assertNonLiveOrAllowed();
  } catch (error) {
    console.error(
      "[stripe/connect] blocked: refusing live-mode onboarding",
      (error as Error).message,
    );
    return NextResponse.json(
      {
        error:
          "Payment onboarding is disabled on this environment pending owner approval.",
        code: "live_mode_blocked",
      },
      { status: 503 },
    );
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    let accountId = therapist.stripeConnectedAccountId;

    // A stored id can be stale: left over from a different Stripe mode, or
    // deleted in the dashboard. Verify before reusing, otherwise accountLinks
    // .create() fails with an opaque 400.
    if (accountId) {
      const existing = await retrieveAccountOrNull(accountId);
      if (!existing) {
        console.warn(
          `[stripe/connect] stored account ${accountId} not found in ` +
            `${getStripeKeyMode()} mode; creating a replacement`,
        );
        accountId = null;
      }
    }

    if (!accountId) {
      const account = await createConnectedAccount(therapist.email, {
        therapistId: therapist.id,
      });
      accountId = account.id;

      await db
        .update(therapists)
        .set({
          stripeConnectedAccountId: accountId,
          // Reset the cached flag: a brand new account has submitted nothing.
          stripeOnboardingComplete: false,
          updatedAt: new Date(),
        })
        .where(eq(therapists.id, therapist.id));
    }

    const url = await createConnectAccountLink(
      accountId,
      // refresh_url is hit when the link expires (they are single-use and
      // short-lived); it must bounce the therapist back through this route.
      `${baseUrl}/therapist/settings?stripe=refresh`,
      `${baseUrl}/therapist/settings?stripe=complete`,
    );

    return NextResponse.json({ url, accountId, mode: getStripeKeyMode() });
  } catch (error) {
    console.error("Stripe connect error:", error);
    return NextResponse.json(
      { error: "Failed to create Stripe link" },
      { status: 500 },
    );
  }
}
