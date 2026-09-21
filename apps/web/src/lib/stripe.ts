/**
 * Stripe Connect Integration
 *
 * Platform takes 1% application fee on all payments.
 * Therapist onboards via Express account.
 */

import Stripe from 'stripe';

// Initialize Stripe with secret key from environment
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2024-09-30.acacia',
});

const PLATFORM_FEE_PERCENT = 1; // 1% platform fee

/**
 * Calculate platform fee (1% of amount)
 */
export function calculatePlatformFee(amountCents: number): number {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}

/**
 * Create a Stripe Connect Express account for a therapist.
 */
export async function createConnectAccount(email: string): Promise<Stripe.Account> {
  return stripe.accounts.create({
    type: 'express',
    email,
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_type: 'individual',
    business_profile: {
      mcc: '8099', // Health services
      product_description: 'Mental health counseling services',
    },
  });
}

/**
 * Create an account link for Express onboarding.
 */
export async function createAccountLink(
  accountId: string,
  refreshUrl: string,
  returnUrl: string
): Promise<Stripe.AccountLink> {
  return stripe.accountLinks.create({
    account: accountId,
    refresh_url: refreshUrl,
    return_url: returnUrl,
    type: 'account_onboarding',
  });
}

/**
 * Create a Checkout Session for an invoice with application fee.
 */
export async function createCheckoutSession(params: {
  connectedAccountId: string;
  amountCents: number;
  description: string;
  clientEmail: string;
  invoiceId: string;
  successUrl: string;
  cancelUrl: string;
}): Promise<Stripe.Checkout.Session> {
  const platformFee = calculatePlatformFee(params.amountCents);

  return stripe.checkout.sessions.create({
    mode: 'payment',
    payment_method_types: ['card'],
    customer_email: params.clientEmail,
    line_items: [
      {
        price_data: {
          currency: 'usd',
          product_data: {
            name: params.description,
          },
          unit_amount: params.amountCents,
        },
        quantity: 1,
      },
    ],
    payment_intent_data: {
      application_fee_amount: platformFee,
      transfer_data: {
        destination: params.connectedAccountId,
      },
    },
    metadata: {
      invoice_id: params.invoiceId,
    },
    success_url: params.successUrl,
    cancel_url: params.cancelUrl,
  });
}

/**
 * Retrieve a payment intent.
 */
export async function getPaymentIntent(paymentIntentId: string): Promise<Stripe.PaymentIntent> {
  return stripe.paymentIntents.retrieve(paymentIntentId);
}

/**
 * Check if a Connect account is fully onboarded.
 */
export async function isAccountOnboarded(accountId: string): Promise<boolean> {
  const account = await stripe.accounts.retrieve(accountId);
  return account.charges_enabled && account.payouts_enabled;
}

export { stripe, PLATFORM_FEE_PERCENT };
