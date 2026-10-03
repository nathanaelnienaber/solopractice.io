import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

/**
 * Route-level tests for POST /api/stripe/connect.
 *
 * Covers the auth boundary, the live-mode kill switch, account reuse, and the
 * stale-account-id recovery path. Stripe and the DB are both mocked, so these
 * run with no network and no DATABASE_URL.
 */

const getSessionTherapistMock = vi.fn();
vi.mock("@/lib/auth", () => ({
  getSessionTherapist: getSessionTherapistMock,
}));

const updateSetWhereMock = vi.fn();
vi.mock("@/db", async () => {
  const actual = await vi.importActual<typeof import("@/db")>("@/db");
  return {
    ...actual,
    db: {
      update: () => ({
        set: (values: unknown) => ({
          where: (cond: unknown) => {
            updateSetWhereMock(values, cond);
            return Promise.resolve([]);
          },
        }),
      }),
    },
  };
});

const createConnectedAccountMock = vi.fn();
const createConnectAccountLinkMock = vi.fn();
const retrieveAccountOrNullMock = vi.fn();
const assertNonLiveOrAllowedMock = vi.fn();
const isStripeConfiguredMock = vi.fn();

vi.mock("@/lib/stripe", () => ({
  createConnectedAccount: createConnectedAccountMock,
  createConnectAccountLink: createConnectAccountLinkMock,
  retrieveAccountOrNull: retrieveAccountOrNullMock,
  assertNonLiveOrAllowed: assertNonLiveOrAllowedMock,
  isStripeConfigured: isStripeConfiguredMock,
  getStripeKeyMode: () => "test",
}));

const THERAPIST = {
  id: "th_abc",
  email: "wife@example.com",
  stripeConnectedAccountId: null as string | null,
  stripeOnboardingComplete: false,
};

function req() {
  return new NextRequest("https://www.solopractice.io/api/stripe/connect", {
    method: "POST",
  });
}

describe("POST /api/stripe/connect", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    isStripeConfiguredMock.mockReturnValue(true);
    assertNonLiveOrAllowedMock.mockImplementation(() => {});
    createConnectAccountLinkMock.mockResolvedValue(
      "https://connect.stripe.com/setup/e/acct_123/abc",
    );
    process.env.NEXT_PUBLIC_APP_URL = "https://www.solopractice.io";
  });

  afterEach(() => {
    delete process.env.NEXT_PUBLIC_APP_URL;
  });

  it("returns 401 when there is no therapist session", async () => {
    getSessionTherapistMock.mockResolvedValue(null);
    const { POST } = await import("./route");

    const res = await POST(req());
    expect(res.status).toBe(401);
    // No Stripe object may be created for an unauthenticated caller.
    expect(createConnectedAccountMock).not.toHaveBeenCalled();
    expect(createConnectAccountLinkMock).not.toHaveBeenCalled();
  });

  it("returns 503 when Stripe is not configured", async () => {
    getSessionTherapistMock.mockResolvedValue({ ...THERAPIST });
    isStripeConfiguredMock.mockReturnValue(false);
    const { POST } = await import("./route");

    const res = await POST(req());
    expect(res.status).toBe(503);
    expect(createConnectedAccountMock).not.toHaveBeenCalled();
  });

  it("BLOCKS with 503 when the key is live mode and not opted in", async () => {
    getSessionTherapistMock.mockResolvedValue({ ...THERAPIST });
    assertNonLiveOrAllowedMock.mockImplementation(() => {
      throw new Error("Refusing to run Stripe Connect onboarding with a LIVE secret key.");
    });
    const { POST } = await import("./route");

    const res = await POST(req());
    expect(res.status).toBe(503);
    const body = await res.json();
    expect(body.code).toBe("live_mode_blocked");
    // Critically: no account is created and no onboarding link is minted.
    expect(createConnectedAccountMock).not.toHaveBeenCalled();
    expect(createConnectAccountLinkMock).not.toHaveBeenCalled();
  });

  it("creates an account and persists the id for a first-time connect", async () => {
    getSessionTherapistMock.mockResolvedValue({ ...THERAPIST });
    createConnectedAccountMock.mockResolvedValue({ id: "acct_new1" });
    const { POST } = await import("./route");

    const res = await POST(req());
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.url).toContain("connect.stripe.com");
    expect(body.accountId).toBe("acct_new1");

    // Stamped with the therapist id for webhook traceability.
    expect(createConnectedAccountMock).toHaveBeenCalledWith(
      "wife@example.com",
      { therapistId: "th_abc" },
    );
    expect(updateSetWhereMock).toHaveBeenCalledWith(
      expect.objectContaining({
        stripeConnectedAccountId: "acct_new1",
        stripeOnboardingComplete: false,
      }),
      expect.anything(),
    );
  });

  it("uses the correct refresh and return URLs", async () => {
    getSessionTherapistMock.mockResolvedValue({ ...THERAPIST });
    createConnectedAccountMock.mockResolvedValue({ id: "acct_new2" });
    const { POST } = await import("./route");

    await POST(req());

    expect(createConnectAccountLinkMock).toHaveBeenCalledWith(
      "acct_new2",
      "https://www.solopractice.io/therapist/settings?stripe=refresh",
      "https://www.solopractice.io/therapist/settings?stripe=complete",
    );
  });

  it("reuses an existing account that Stripe still recognises", async () => {
    getSessionTherapistMock.mockResolvedValue({
      ...THERAPIST,
      stripeConnectedAccountId: "acct_existing",
    });
    retrieveAccountOrNullMock.mockResolvedValue({ id: "acct_existing" });
    const { POST } = await import("./route");

    const res = await POST(req());
    expect(res.status).toBe(200);
    // No duplicate account, no redundant DB write.
    expect(createConnectedAccountMock).not.toHaveBeenCalled();
    expect(updateSetWhereMock).not.toHaveBeenCalled();
    expect(createConnectAccountLinkMock).toHaveBeenCalledWith(
      "acct_existing",
      expect.any(String),
      expect.any(String),
    );
  });

  it("replaces a stale account id Stripe no longer knows about", async () => {
    getSessionTherapistMock.mockResolvedValue({
      ...THERAPIST,
      stripeConnectedAccountId: "acct_stale_from_live_mode",
    });
    // Simulates a stored id from another Stripe mode / a deleted account.
    retrieveAccountOrNullMock.mockResolvedValue(null);
    createConnectedAccountMock.mockResolvedValue({ id: "acct_fresh" });
    const { POST } = await import("./route");

    const res = await POST(req());
    expect(res.status).toBe(200);
    expect(createConnectedAccountMock).toHaveBeenCalled();
    expect(createConnectAccountLinkMock).toHaveBeenCalledWith(
      "acct_fresh",
      expect.any(String),
      expect.any(String),
    );
  });

  it("IGNORES a client-supplied accountId (no cross-therapist access)", async () => {
    getSessionTherapistMock.mockResolvedValue({
      ...THERAPIST,
      stripeConnectedAccountId: "acct_mine",
    });
    retrieveAccountOrNullMock.mockResolvedValue({ id: "acct_mine" });
    const { POST } = await import("./route");

    // Attacker tries to mint an onboarding link for someone else's account.
    const malicious = new NextRequest(
      "https://www.solopractice.io/api/stripe/connect",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ accountId: "acct_VICTIM" }),
      },
    );

    const res = await POST(malicious);
    expect(res.status).toBe(200);

    // The link must be for the session therapist's own account only.
    expect(createConnectAccountLinkMock).toHaveBeenCalledWith(
      "acct_mine",
      expect.any(String),
      expect.any(String),
    );
    const callArgs = createConnectAccountLinkMock.mock.calls[0];
    expect(callArgs[0]).not.toBe("acct_VICTIM");
  });

  it("returns 500 without leaking Stripe internals when Stripe fails", async () => {
    getSessionTherapistMock.mockResolvedValue({ ...THERAPIST });
    createConnectedAccountMock.mockRejectedValue(
      new Error("Stripe internal detail that must not reach the client"),
    );
    const { POST } = await import("./route");

    const res = await POST(req());
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error).toBe("Failed to create Stripe link");
    expect(JSON.stringify(body)).not.toContain("internal detail");
  });
});
