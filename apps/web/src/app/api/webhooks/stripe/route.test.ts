import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Webhook tests. Two things matter most here and are asserted directly:
 *  - an invalid/missing signature NEVER reaches a DB write
 *  - readiness is derived, not latched (a restricted account flips back to
 *    not-ready instead of staying "ready to accept payments" forever)
 */

const constructEventMock = vi.fn();
const accountsRetrieveMock = vi.fn();
const isStripeConfiguredMock = vi.fn();

vi.mock("@/lib/stripe", () => ({
  stripe: {
    webhooks: { constructEvent: constructEventMock },
    accounts: { retrieve: accountsRetrieveMock },
  },
  isStripeConfigured: isStripeConfiguredMock,
}));

// Capture every therapist/invoice update so we can assert on persisted values.
const therapistUpdates: unknown[] = [];
const invoiceUpdates: unknown[] = [];
let returningRows: Array<{ id: string }> = [];

vi.mock("@/db", async () => {
  const actual = await vi.importActual<typeof import("@/db")>("@/db");
  const makeUpdate = (sink: unknown[]) => ({
    set: (values: unknown) => {
      sink.push(values);
      return {
        where: () => {
          const p: Promise<Array<{ id: string }>> = Promise.resolve(returningRows);
          return Object.assign(p, {
            returning: () => Promise.resolve(returningRows),
          });
        },
      };
    },
  });

  return {
    ...actual,
    db: {
      update: (table: unknown) =>
        table === actual.therapists
          ? makeUpdate(therapistUpdates)
          : makeUpdate(invoiceUpdates),
    },
  };
});

function webhookReq(body = "{}", sig: string | null = "t=1,v1=fake") {
  const headers = new Headers();
  if (sig) headers.set("stripe-signature", sig);
  return new NextRequest("https://www.solopractice.io/api/webhooks/stripe", {
    method: "POST",
    headers,
    body,
  });
}

function accountEvent(account: Record<string, unknown>) {
  return {
    id: "evt_test_1",
    type: "account.updated",
    livemode: false,
    data: { object: { object: "account", ...account } },
  };
}

describe("POST /api/webhooks/stripe", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    therapistUpdates.length = 0;
    invoiceUpdates.length = 0;
    returningRows = [{ id: "th_abc" }];
    isStripeConfiguredMock.mockReturnValue(true);
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    process.env.STRIPE_WEBHOOK_SECRET = "whsec_abc";
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
  });

  it("rejects a request with no stripe-signature header", async () => {
    const { POST } = await import("./route");
    const res = await POST(webhookReq("{}", null));
    expect(res.status).toBe(400);
    expect(constructEventMock).not.toHaveBeenCalled();
    expect(therapistUpdates).toHaveLength(0);
  });

  it("rejects when the webhook secret is not configured", async () => {
    delete process.env.STRIPE_WEBHOOK_SECRET;
    const { POST } = await import("./route");
    const res = await POST(webhookReq());
    expect(res.status).toBe(400);
    expect(therapistUpdates).toHaveLength(0);
  });

  it("rejects a FORGED signature and performs no DB write", async () => {
    constructEventMock.mockImplementation(() => {
      throw new Error("No signatures found matching the expected signature");
    });
    const { POST } = await import("./route");

    const res = await POST(webhookReq(JSON.stringify(accountEvent({ id: "acct_x" }))));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("Invalid signature");
    // The critical assertion: unverified payloads never mutate state.
    expect(therapistUpdates).toHaveLength(0);
    expect(invoiceUpdates).toHaveLength(0);
  });

  it("returns 503 (retryable) when Stripe is not configured", async () => {
    isStripeConfiguredMock.mockReturnValue(false);
    const { POST } = await import("./route");
    const res = await POST(webhookReq());
    expect(res.status).toBe(503);
  });

  it("marks onboarding complete when charges become enabled", async () => {
    constructEventMock.mockReturnValue(
      accountEvent({
        id: "acct_ready",
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
        requirements: { currently_due: [], past_due: [] },
      }),
    );
    const { POST } = await import("./route");

    const res = await POST(webhookReq());
    expect(res.status).toBe(200);
    expect(therapistUpdates).toHaveLength(1);
    expect(therapistUpdates[0]).toMatchObject({
      stripeOnboardingComplete: true,
    });
  });

  it("does NOT mark complete while onboarding is unfinished", async () => {
    constructEventMock.mockReturnValue(
      accountEvent({
        id: "acct_partial",
        charges_enabled: false,
        details_submitted: false,
        requirements: { currently_due: ["external_account"] },
      }),
    );
    const { POST } = await import("./route");

    await POST(webhookReq());
    expect(therapistUpdates[0]).toMatchObject({
      stripeOnboardingComplete: false,
    });
  });

  it("REVOKES readiness when a previously-ready account becomes restricted", async () => {
    // Regression guard: the original handler only ever set the flag to true,
    // so an account that Stripe later restricted stayed "ready" in our UI.
    constructEventMock.mockReturnValue(
      accountEvent({
        id: "acct_restricted",
        charges_enabled: false,
        payouts_enabled: false,
        details_submitted: true,
        requirements: {
          currently_due: ["individual.verification.document"],
          disabled_reason: "requirements.currently_due",
        },
      }),
    );
    const { POST } = await import("./route");

    await POST(webhookReq());
    expect(therapistUpdates).toHaveLength(1);
    expect(therapistUpdates[0]).toMatchObject({
      stripeOnboardingComplete: false,
    });
  });

  it("relinks via metadata.therapistId when no row matches the account id", async () => {
    // First update (by account id) matches nothing, second (by id) matches.
    let call = 0;
    returningRows = [];
    const { POST } = await import("./route");

    constructEventMock.mockReturnValue(
      accountEvent({
        id: "acct_orphan",
        charges_enabled: true,
        details_submitted: true,
        metadata: { therapistId: "th_recover" },
        requirements: {},
      }),
    );

    // Make the by-account-id update return no rows, the metadata one return a row.
    const dbModule = await import("@/db");
    const originalUpdate = dbModule.db.update;
    vi.spyOn(dbModule.db, "update").mockImplementation((table: unknown) => {
      call += 1;
      returningRows = call === 1 ? [] : [{ id: "th_recover" }];
      return (originalUpdate as (t: unknown) => unknown)(table) as never;
    });

    const res = await POST(webhookReq());
    expect(res.status).toBe(200);
    // Second write restores the account id link.
    expect(therapistUpdates.at(-1)).toMatchObject({
      stripeConnectedAccountId: "acct_orphan",
      stripeOnboardingComplete: true,
    });
  });

  it("ignores an event from the wrong Stripe mode", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_live",
      type: "account.updated",
      livemode: true, // live event hitting a test-mode deployment
      data: { object: { object: "account", id: "acct_live", charges_enabled: true } },
    });
    const { POST } = await import("./route");

    const res = await POST(webhookReq());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ignored).toBe("mode_mismatch");
    // Must not touch state based on a cross-mode event.
    expect(therapistUpdates).toHaveLength(0);
  });

  it("clears the connection on account.application.deauthorized", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_deauth",
      type: "account.application.deauthorized",
      livemode: false,
      account: "acct_gone",
      data: { object: { object: "application", id: "ca_1" } },
    });
    const { POST } = await import("./route");

    const res = await POST(webhookReq());
    expect(res.status).toBe(200);
    expect(therapistUpdates[0]).toMatchObject({
      stripeOnboardingComplete: false,
      stripeConnectedAccountId: null,
    });
  });

  it("marks an invoice paid on checkout.session.completed", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_co",
      type: "checkout.session.completed",
      livemode: false,
      data: {
        object: {
          object: "checkout.session",
          metadata: { invoiceId: "inv_1" },
          payment_intent: "pi_123",
        },
      },
    });
    const { POST } = await import("./route");

    const res = await POST(webhookReq());
    expect(res.status).toBe(200);
    expect(invoiceUpdates[0]).toMatchObject({
      status: "paid",
      stripePaymentIntentId: "pi_123",
    });
  });

  it("returns 500 so Stripe retries when a handler throws", async () => {
    constructEventMock.mockReturnValue(
      accountEvent({ id: "acct_boom", charges_enabled: true }),
    );
    const dbModule = await import("@/db");
    vi.spyOn(dbModule.db, "update").mockImplementation(() => {
      throw new Error("database unavailable");
    });
    const { POST } = await import("./route");

    const res = await POST(webhookReq());
    expect(res.status).toBe(500);
  });

  it("acknowledges unhandled event types without error", async () => {
    constructEventMock.mockReturnValue({
      id: "evt_other",
      type: "payout.created",
      livemode: false,
      data: { object: { object: "payout" } },
    });
    const { POST } = await import("./route");

    const res = await POST(webhookReq());
    expect(res.status).toBe(200);
    expect(therapistUpdates).toHaveLength(0);
  });
});
