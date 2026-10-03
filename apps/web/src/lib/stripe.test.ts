import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

/**
 * Guards around the live/test mode gate. These are the tests that stop someone
 * accidentally wiring a real bank account to a real-money flow, so they assert
 * fail-closed behaviour explicitly rather than just the happy path.
 */
describe("stripe key mode detection", () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  async function load() {
    return import("./stripe");
  }

  it("classifies sk_test_ keys as test mode", async () => {
    const { getStripeKeyMode } = await load();
    expect(getStripeKeyMode("sk_test_abc123")).toBe("test");
  });

  it("classifies sk_live_ keys as live mode", async () => {
    const { getStripeKeyMode } = await load();
    expect(getStripeKeyMode("sk_live_abc123")).toBe("live");
  });

  it("classifies restricted keys by embedded mode when present", async () => {
    const { getStripeKeyMode } = await load();
    expect(getStripeKeyMode("rk_test_abc")).toBe("test");
    expect(getStripeKeyMode("rk_live_abc")).toBe("live");
  });

  it("does NOT assume a bare rk_ key is safe", async () => {
    const { getStripeKeyMode } = await load();
    // A restricted key with no mode in the prefix could be live; it must not be
    // silently treated as test mode.
    expect(getStripeKeyMode("rk_abc123")).toBe("restricted");
  });

  it("reports unknown for absent or unrecognised keys", async () => {
    const { getStripeKeyMode } = await load();
    expect(getStripeKeyMode(undefined)).toBe("unknown");
    expect(getStripeKeyMode("")).toBe("unknown");
    expect(getStripeKeyMode("garbage")).toBe("unknown");
  });

  it("isLiveMode reflects the configured env key", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_xyz";
    const { isLiveMode } = await load();
    expect(isLiveMode()).toBe(true);
  });

  it("isLiveMode is false for a test key", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_xyz";
    const { isLiveMode } = await load();
    expect(isLiveMode()).toBe(false);
  });
});

describe("assertNonLiveOrAllowed", () => {
  const ORIGINAL = { ...process.env };

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    process.env = { ...ORIGINAL };
  });

  it("allows test-mode keys", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_test_abc";
    delete process.env.STRIPE_ALLOW_LIVE_MODE;
    const { assertNonLiveOrAllowed } = await import("./stripe");
    expect(() => assertNonLiveOrAllowed()).not.toThrow();
  });

  it("THROWS on a live key when not explicitly allowed", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_abc";
    delete process.env.STRIPE_ALLOW_LIVE_MODE;
    const { assertNonLiveOrAllowed } = await import("./stripe");
    expect(() => assertNonLiveOrAllowed()).toThrow(/LIVE secret key/i);
  });

  it("permits a live key only with the explicit opt-in flag", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_abc";
    process.env.STRIPE_ALLOW_LIVE_MODE = "true";
    const { assertNonLiveOrAllowed } = await import("./stripe");
    expect(() => assertNonLiveOrAllowed()).not.toThrow();
  });

  it("does not accept a truthy-ish value other than 'true' as opt-in", async () => {
    process.env.STRIPE_SECRET_KEY = "sk_live_abc";
    process.env.STRIPE_ALLOW_LIVE_MODE = "1";
    const { assertNonLiveOrAllowed } = await import("./stripe");
    expect(() => assertNonLiveOrAllowed()).toThrow();
  });

  it("THROWS on an ambiguous restricted key", async () => {
    process.env.STRIPE_SECRET_KEY = "rk_abc";
    delete process.env.STRIPE_ALLOW_LIVE_MODE;
    const { assertNonLiveOrAllowed } = await import("./stripe");
    expect(() => assertNonLiveOrAllowed()).toThrow(/restricted key/i);
  });

  it("does not throw when no key is configured (handled by isStripeConfigured)", async () => {
    delete process.env.STRIPE_SECRET_KEY;
    const { assertNonLiveOrAllowed } = await import("./stripe");
    expect(() => assertNonLiveOrAllowed()).not.toThrow();
  });
});

describe("calculateApplicationFee", () => {
  it("takes the configured platform percentage, rounded to cents", async () => {
    const { calculateApplicationFee } = await import("./stripe");
    const { PLATFORM_FEE_PERCENT } = await import("@solopractice/shared");
    // 1% of $150.00 = $1.50
    expect(calculateApplicationFee(15000)).toBe(
      Math.round(15000 * (PLATFORM_FEE_PERCENT / 100)),
    );
  });

  it("never returns a fractional cent", async () => {
    const { calculateApplicationFee } = await import("./stripe");
    const fee = calculateApplicationFee(3333);
    expect(Number.isInteger(fee)).toBe(true);
  });
});
