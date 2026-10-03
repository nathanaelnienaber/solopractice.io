/**
 * Route-level tests for POST /api/invoices/[id]/checkout.
 *
 * This is the only route that moves real money, and it is deliberately
 * unauthenticated (the invoice id is a bearer capability emailed to the
 * client). Two guards are covered here:
 *
 *  1. The live-mode kill switch. Connect onboarding was gated by
 *     assertNonLiveOrAllowed() but the charge path was not, so a deployment
 *     holding a live key — or a therapist who connected before the guard
 *     existed — could still take real money. Gating onboarding alone is not
 *     the same as gating payments.
 *
 *  2. Destination readiness. The route previously handed any stored
 *     stripeConnectedAccountId straight to Checkout and let Stripe decide,
 *     which surfaces to the paying client as an opaque 500 after they have
 *     already committed to paying.
 *
 * Stripe and the DB are mocked; no network, no DATABASE_URL.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const THERAPIST = {
  id: "th_abc",
  email: "therapist@example.com",
  stripeConnectedAccountId: "acct_connected",
  stripeOnboardingComplete: true,
};

const SENT_INVOICE = {
  id: "inv_sent_00000000001",
  therapistId: THERAPIST.id,
  clientId: "cl_000000000000000001",
  amountCents: 15_000,
  description: "Therapy session",
  status: "sent" as string,
  client: { email: "client@example.com" },
  therapist: THERAPIST,
};

let invoiceRow: Record<string, unknown> | undefined = SENT_INVOICE;

const updateSetWhereMock = vi.fn();
vi.mock("@/db", async () => {
  const actual = await vi.importActual<typeof import("@/db")>("@/db");
  return {
    ...actual,
    db: {
      query: {
        invoices: {
          findFirst: vi.fn(async () => invoiceRow),
        },
      },
      update: () => ({
        set: (values: unknown) => ({
          where: (cond: unknown) => {
            updateSetWhereMock(values, cond);
            return Promise.resolve();
          },
        }),
      }),
    },
  };
});

const createCheckoutSessionMock = vi.fn();
const retrieveAccountOrNullMock = vi.fn();
const assertNonLiveOrAllowedMock = vi.fn();
const isStripeConfiguredMock = vi.fn();

vi.mock("@/lib/stripe", () => ({
  createCheckoutSession: createCheckoutSessionMock,
  retrieveAccountOrNull: retrieveAccountOrNullMock,
  assertNonLiveOrAllowed: assertNonLiveOrAllowedMock,
  isStripeConfigured: isStripeConfiguredMock,
}));

/** A fully verified Stripe account: charges and payouts both enabled. */
const READY_ACCOUNT = {
  id: "acct_connected",
  charges_enabled: true,
  payouts_enabled: true,
  details_submitted: true,
  requirements: { currently_due: [], past_due: [] },
};

async function postCheckout(id = SENT_INVOICE.id) {
  const { POST } = await import("./route");
  const request = new NextRequest(
    `https://www.solopractice.io/api/invoices/${id}/checkout`,
    { method: "POST" },
  );
  return POST(request, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  invoiceRow = SENT_INVOICE;
  isStripeConfiguredMock.mockReturnValue(true);
  assertNonLiveOrAllowedMock.mockImplementation(() => {});
  retrieveAccountOrNullMock.mockResolvedValue(READY_ACCOUNT);
  createCheckoutSessionMock.mockResolvedValue({
    id: "cs_test_123",
    url: "https://checkout.stripe.com/c/pay/cs_test_123",
  });
});

describe("POST /api/invoices/[id]/checkout — live-mode guard", () => {
  it("BLOCKS the charge with 503 when the key is live and not opted in", async () => {
    assertNonLiveOrAllowedMock.mockImplementation(() => {
      throw new Error(
        "Refusing to run Stripe Connect onboarding with a LIVE secret key.",
      );
    });

    const response = await postCheckout();

    expect(response.status).toBe(503);
    expect((await response.json()).code).toBe("live_mode_blocked");

    // The whole point: no Checkout Session, so no real money can move.
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
    // And the invoice must not be mutated as a side effect of the attempt.
    expect(updateSetWhereMock).not.toHaveBeenCalled();
  });

  it("blocks before making any Stripe API call at all", async () => {
    assertNonLiveOrAllowedMock.mockImplementation(() => {
      throw new Error("live key");
    });

    await postCheckout();

    // A live-mode deployment must not even enumerate connected-account state.
    expect(retrieveAccountOrNullMock).not.toHaveBeenCalled();
  });

  it("blocks a mode-ambiguous restricted (rk_) key the same way", async () => {
    assertNonLiveOrAllowedMock.mockImplementation(() => {
      throw new Error("Stripe secret key is a restricted key (rk_)");
    });

    const response = await postCheckout();
    expect(response.status).toBe(503);
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("allows the charge when the guard passes (test key, or opted in)", async () => {
    const response = await postCheckout();

    expect(response.status).toBe(200);
    expect((await response.json()).url).toContain("checkout.stripe.com");
    expect(assertNonLiveOrAllowedMock).toHaveBeenCalled();
    expect(createCheckoutSessionMock).toHaveBeenCalledTimes(1);
  });

  it("returns 503 when Stripe is not configured at all", async () => {
    isStripeConfiguredMock.mockReturnValue(false);

    const response = await postCheckout();

    expect(response.status).toBe(503);
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });
});

describe("POST /api/invoices/[id]/checkout — destination readiness", () => {
  it("refuses to charge when the account cannot accept payments", async () => {
    // Submitted, but Stripe has not enabled charges yet.
    retrieveAccountOrNullMock.mockResolvedValue({
      id: "acct_connected",
      charges_enabled: false,
      payouts_enabled: false,
      details_submitted: true,
      requirements: { currently_due: ["individual.id_number"], past_due: [] },
    });

    const response = await postCheckout();

    expect(response.status).toBe(409);
    expect((await response.json()).code).toBe("destination_not_ready");
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
    expect(updateSetWhereMock).not.toHaveBeenCalled();
  });

  it("refuses when the stored account id no longer exists at Stripe", async () => {
    // Stale id: deleted account, or one from a different Stripe mode.
    retrieveAccountOrNullMock.mockResolvedValue(null);

    const response = await postCheckout();

    expect(response.status).toBe(409);
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("refuses when onboarding was never completed", async () => {
    retrieveAccountOrNullMock.mockResolvedValue({
      id: "acct_connected",
      charges_enabled: false,
      details_submitted: false,
    });

    const response = await postCheckout();
    expect(response.status).toBe(409);
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("does not leak the therapist's Stripe requirements to the payer", async () => {
    retrieveAccountOrNullMock.mockResolvedValue({
      id: "acct_connected",
      charges_enabled: false,
      details_submitted: true,
      requirements: {
        currently_due: ["individual.id_number", "individual.ssn_last_4"],
        past_due: ["individual.verification.document"],
      },
    });

    const response = await postCheckout();
    const raw = JSON.stringify(await response.json());

    // The payer is an unauthenticated bearer of an invoice id; the therapist's
    // identity-verification state is none of their business.
    expect(raw).not.toContain("ssn");
    expect(raw).not.toContain("id_number");
    expect(raw).not.toContain("verification");
    expect(raw).not.toContain("acct_connected");
  });

  it("ALLOWS the charge when charges are enabled but payouts are still pending", async () => {
    // "ready_payouts_pending" is a legitimate paying state — money can be
    // taken, it just has not reached the therapist's bank yet. Blocking this
    // would be a false negative that costs the therapist a payment.
    retrieveAccountOrNullMock.mockResolvedValue({
      id: "acct_connected",
      charges_enabled: true,
      payouts_enabled: false,
      details_submitted: true,
      requirements: { currently_due: [], past_due: [] },
    });

    const response = await postCheckout();

    expect(response.status).toBe(200);
    expect(createCheckoutSessionMock).toHaveBeenCalledTimes(1);
  });
});

describe("POST /api/invoices/[id]/checkout — pre-existing guards still hold", () => {
  it("returns 404 for an unknown invoice", async () => {
    invoiceRow = undefined;
    const response = await postCheckout("inv_does_not_exist_1");
    expect(response.status).toBe(404);
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("returns 400 for an already-paid invoice", async () => {
    invoiceRow = { ...SENT_INVOICE, status: "paid" };
    const response = await postCheckout();
    expect(response.status).toBe(400);
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("returns 404 for a draft invoice and does not flip it to sent", async () => {
    invoiceRow = { ...SENT_INVOICE, status: "draft" };
    const response = await postCheckout();
    expect(response.status).toBe(404);
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
    expect(updateSetWhereMock).not.toHaveBeenCalled();
  });

  it("returns 400 when the therapist has no connected account", async () => {
    invoiceRow = {
      ...SENT_INVOICE,
      therapist: { ...THERAPIST, stripeConnectedAccountId: null },
    };
    const response = await postCheckout();
    expect(response.status).toBe(400);
    expect(createCheckoutSessionMock).not.toHaveBeenCalled();
  });

  it("returns 500 without leaking Stripe internals when Checkout fails", async () => {
    createCheckoutSessionMock.mockRejectedValue(
      new Error("Stripe internal detail that must not reach the client"),
    );

    const response = await postCheckout();

    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain(
      "internal detail",
    );
  });
});
