/**
 * Stripe Connect Integration
 *
 * Uses Stripe Connect Express with destination charges.
 * Platform takes 1% application fee on all payments.
 */

import Stripe from "stripe";
import { PLATFORM_FEE_PERCENT } from "@solopractice/shared";

if (!process.env.STRIPE_SECRET_KEY) {
  console.warn("STRIPE_SECRET_KEY not set - Stripe features will not work");
}

export function isStripeConfigured(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY);
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
  email: string
): Promise<Stripe.Account> {
  return stripe.accounts.create({
    type: "express",
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
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
