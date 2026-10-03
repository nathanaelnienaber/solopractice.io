import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Tests for GET /api/stripe/connect/status — the endpoint the settings page
 * polls after returning from Stripe's hosted onboarding.
 */

const getSessionTherapistMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSessionTherapist: getSessionTherapistMock,
}));

const therapistUpdates: unknown[] = [];
vi.mock("@/db", async () => {
  const actual = await vi.importActual<typeof import("@/db")>("@/db");
  return {
    ...actual,
    db: {
      update: () => ({
        set: (values: unknown) => {
          therapistUpdates.push(values);
          return { where: () => Promise.resolve([]) };
        },
      }),
    },
  };
});

const retrieveAccountOrNullMock = vi.fn();
const isStripeConfiguredMock = vi.fn();
vi.mock("@/lib/stripe", () => ({
  retrieveAccountOrNull: retrieveAccountOrNullMock,
  isStripeConfigured: isStripeConfiguredMock,
  getStripeKeyMode: () => "test",
}));

describe("GET /api/stripe/connect/status", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    therapistUpdates.length = 0;
    isStripeConfiguredMock.mockReturnValue(true);
  });

  it("returns 401 for an unauthenticated caller", async () => {
    getSessionTherapistMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const res = await GET();
    expect(res.status).toBe(401);
    expect(retrieveAccountOrNullMock).not.toHaveBeenCalled();
  });

  it("reports not_connected without calling Stripe when no account exists", async () => {
    getSessionTherapistMock.mockResolvedValue({
      id: "th_1",
      stripeConnectedAccountId: null,
      stripeOnboardingComplete: false,
    });
    const { GET } = await import("./route");

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe("not_connected");
    expect(body.canAcceptPayments).toBe(false);
    expect(body.copy.label).toBe("Not connected");
    // No pointless Stripe round-trip for an account that does not exist.
    expect(retrieveAccountOrNullMock).not.toHaveBeenCalled();
  });

  it("returns a ready snapshot with human-readable copy", async () => {
    getSessionTherapistMock.mockResolvedValue({
      id: "th_1",
      stripeConnectedAccountId: "acct_ready",
      stripeOnboardingComplete: true,
    });
    retrieveAccountOrNullMock.mockResolvedValue({
      id: "acct_ready",
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
      requirements: { currently_due: [], past_due: [] },
    });
    const { GET } = await import("./route");

    const body = await (await GET()).json();
    expect(body.status).toBe("ready");
    expect(body.canAcceptPayments).toBe(true);
    expect(body.mode).toBe("test");
    expect(body.outstanding).toEqual([]);
    // Already in sync -> no redundant write.
    expect(therapistUpdates).toHaveLength(0);
  });

  it("self-heals the cached DB flag when Stripe disagrees", async () => {
    // Webhook was missed: DB says incomplete, Stripe says charges are enabled.
    getSessionTherapistMock.mockResolvedValue({
      id: "th_1",
      stripeConnectedAccountId: "acct_ready",
      stripeOnboardingComplete: false,
    });
    retrieveAccountOrNullMock.mockResolvedValue({
      id: "acct_ready",
      charges_enabled: true,
      payouts_enabled: true,
      details_submitted: true,
    });
    const { GET } = await import("./route");

    await GET();
    expect(therapistUpdates).toHaveLength(1);
    expect(therapistUpdates[0]).toMatchObject({
      stripeOnboardingComplete: true,
    });
  });

  it("surfaces outstanding requirements in plain language", async () => {
    getSessionTherapistMock.mockResolvedValue({
      id: "th_1",
      stripeConnectedAccountId: "acct_restricted",
      stripeOnboardingComplete: false,
    });
    retrieveAccountOrNullMock.mockResolvedValue({
      id: "acct_restricted",
      charges_enabled: false,
      details_submitted: true,
      requirements: {
        currently_due: ["external_account", "individual.verification.document"],
        past_due: [],
      },
    });
    const { GET } = await import("./route");

    const body = await (await GET()).json();
    expect(body.status).toBe("restricted");
    expect(body.outstanding).toContain("Bank account details");
    expect(body.outstanding).toContain("Identity document");
    expect(body.needsOnboarding).toBe(true);
  });

  it("treats a vanished account as not_connected", async () => {
    getSessionTherapistMock.mockResolvedValue({
      id: "th_1",
      stripeConnectedAccountId: "acct_stale",
      stripeOnboardingComplete: true,
    });
    retrieveAccountOrNullMock.mockResolvedValue(null);
    const { GET } = await import("./route");

    const body = await (await GET()).json();
    expect(body.status).toBe("not_connected");
    expect(body.accountId).toBeNull();
  });

  it("returns 502 when Stripe errors unexpectedly", async () => {
    getSessionTherapistMock.mockResolvedValue({
      id: "th_1",
      stripeConnectedAccountId: "acct_x",
      stripeOnboardingComplete: false,
    });
    retrieveAccountOrNullMock.mockRejectedValue(new Error("Stripe is down"));
    const { GET } = await import("./route");

    const res = await GET();
    expect(res.status).toBe(502);
  });
});
