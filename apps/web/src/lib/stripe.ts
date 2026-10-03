/**
 * Stripe Connect Integration
 *
 * Uses Stripe Connect Express with destination charges.
 * Platform takes 1% application fee on all payments.
 */

import Stripe from "stripe";
import { PLATFORM_FEE_PERCENT } from "@solopractice/shared";
import {
  deriveConnectStatus,
  type ConnectStatusSnapshot,
} from "./stripe-connect-status";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY not set - Stripe features will not work");
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

export type StripeKeyMode = "test" | "live" | "restricted" | "unknown";

/**
 * Classify the configured secret key by prefix WITHOUT ever logging or
 * returning the key material itself.
 *
 * `rk_` (restricted) keys are reported separately because their prefix does not
 * encode the mode — a restricted key can be live, so it must not be treated as
 * safe-by-default.
 */
export function getStripeKeyMode(
  key: string | undefined = process.env.STRIPE_SECRET_KEY,
): StripeKeyMode {
  if (!key) return "unknown";
  if (key.startsWith("sk_test_")) return "test";
  if (key.startsWith("sk_live_")) return "live";
  if (key.startsWith("rk_test_")) return "test";
  if (key.startsWith("rk_live_")) return "live";
  if (key.startsWith("rk_")) return "restricted";
  return "unknown";
}

export function isLiveMode(): boolean {
  return getStripeKeyMode() === "live";
}

/**
 * Guard for flows that must not touch real money during the pilot.
 *
 * Set STRIPE_ALLOW_LIVE_MODE="true" to deliberately opt in to live keys. Until
 * then a live key fails closed: wiring real bank payouts by accident is a much
 * worse outcome than a 503 on the settings page.
 */
export function assertNonLiveOrAllowed(): void {
  const mode = getStripeKeyMode();
  if (mode === "live" && process.env.STRIPE_ALLOW_LIVE_MODE !== "true") {
    throw new Error(
      "Refusing to run Stripe Connect onboarding with a LIVE secret key. " +
        "This flow is pilot-gated to test mode. Set STRIPE_ALLOW_LIVE_MODE=true " +
        "only with explicit owner sign-off.",
    );
  }
  if (mode === "restricted" && process.env.STRIPE_ALLOW_LIVE_MODE !== "true") {
    throw new Error(
      "Stripe secret key is a restricted key (rk_) whose mode cannot be " +
        "determined from its prefix. Refusing to proceed; supply an sk_test_ key " +
        "or set STRIPE_ALLOW_LIVE_MODE=true with explicit owner sign-off.",
    );
  }
}

function createStripe(): Stripe {
  // `new Stripe("")` throws ("Neither apiKey nor config.authenticator
  // provided"), so this must never run at module-evaluation time: Next.js
  // imports every route module during "Collecting page data" in `next build`,
  // where production secrets are intentionally absent.
  return new Stripe(process.env.STRIPE_SECRET_KEY ?? "", {
    // Must be a version literal accepted by the installed stripe SDK (v17.7.0).
    // The previously hardcoded "2025-05-28.basil" does not exist in this SDK's
    // type union and fails the build; 2025-02-24.acacia is its latest accepted pin.
    // Bump deliberately when the SDK is upgraded, not opportunistically.
    apiVersion: "2025-02-24.acacia",
  });
}

let stripeInstance: Stripe | undefined;

function getStripe(): Stripe {
  if (!stripeInstance) {
    stripeInstance = createStripe();
  }
  return stripeInstance;
}

/**
 * Lazily-initialised Stripe client. Constructed on first property access
 * rather than at import time, so the build does not require a secret key.
 */
export const stripe = new Proxy({} as Stripe, {
  get(_target, prop, receiver) {
    const value = Reflect.get(getStripe() as object, prop, receiver);
    return typeof value === "function" ? value.bind(getStripe()) : value;
  },
  has(_target, prop) {
    return Reflect.has(getStripe() as object, prop);
  },
});

export function calculateApplicationFee(amountCents: number): number {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}

export async function createConnectAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
): Promise<string> {
  const accountLink = await stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: "account_onboarding",
  });
  return accountLink.url;
}

export async function createConnectedAccount(
  email: string,
  options: { therapistId?: string } = {},
): Promise<Stripe.Account> {
  return stripe.accounts.create({
    type: "express",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: "individual",
    business_profile: {
      // 8931 = "Legal, accounting, and professional services"; Stripe requires an
      // MCC for Express accounts and asking the therapist for one is pointless.
      mcc: "8931",
      product_description: "Mental health therapy and counseling services",
    },
    // Stamped so an `account.updated` webhook can be traced back to a therapist
    // row even if the local DB write failed after account creation.
    metadata: options.therapistId
      ? { therapistId: options.therapistId }
      : {},
  });
}

export async function createCheckoutSession({
  connectedAccountId,
  amountCents,
  description,
  clientEmail,
  successUrl,
  cancelUrl,
  invoiceId,
}: {
  connectedAccountId: string;
  amountCents: number;
  description: string;
  clientEmail: string;
  successUrl: string;
  cancelUrl: string;
  invoiceId: string;
}): Promise<Stripe.Checkout.Session> {
  const applicationFee = calculateApplicationFee(amountCents);

  return stripe.checkout.sessions.create({
    payment_method_types: ["card"],
    line_items: [
      {
        price_data: {
          currency: "usd",
          product_data: {
            name: description,
          },
          unit_amount: amountCents,
        },
        quantity: 1,
      },
    ],
    mode: "payment",
    success_url: successUrl,
    cancel_url: cancelUrl,
    customer_email: clientEmail,
    payment_intent_data: {
      application_fee_amount: applicationFee,
      transfer_data: {
        destination: connectedAccountId,
      },
    },
    metadata: {
      invoiceId,
    },
  });
}

export async function getAccountStatus(
  accountId: string
): Promise<{
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
}> {
  const account = await stripe.accounts.retrieve(accountId);
  return {
    chargesEnabled: account.charges_enabled ?? false,
    payoutsEnabled: account.payouts_enabled ?? false,
    detailsSubmitted: account.details_submitted ?? false,
  };
}

/**
 * Full status snapshot for the settings UI: includes Stripe's outstanding
 * `requirements`, which `getAccountStatus` discards. Prefer this for anything
 * that has to explain *why* an account is not ready yet.
 */
export async function getConnectStatusSnapshot(
  accountId: string,
): Promise<ConnectStatusSnapshot> {
  const account = await stripe.accounts.retrieve(accountId);
  return deriveConnectStatus(account);
}

/** Retrieve a connected account, returning null when Stripe no longer has it. */
export async function retrieveAccountOrNull(
  accountId: string,
): Promise<Stripe.Account | null> {
  try {
    return await stripe.accounts.retrieve(accountId);
  } catch (error) {
    // A stored account id from a different Stripe mode (or a deleted account)
    // 404s/400s here. Treat as "no account" so the UI can offer a fresh connect
    // instead of hard-failing the whole settings page.
    const code = (error as { statusCode?: number } | null)?.statusCode;
    if (code === 404 || code === 400 || code === 403) {
      return null;
    }
    throw error;
  }
}
