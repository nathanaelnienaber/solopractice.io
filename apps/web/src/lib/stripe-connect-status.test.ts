import { describe, it, expect } from "vitest";
import {
  deriveConnectStatus,
  describeConnectStatus,
  describeRequirement,
  describeOutstandingRequirements,
  type AccountLike,
} from "./stripe-connect-status";

/**
 * Fixtures mirror the shapes Stripe actually returns at each stage of Express
 * onboarding. Field combinations are taken from real Connect account payloads.
 */
const account = (over: Partial<AccountLike> = {}): AccountLike => ({
  charges_enabled: false,
  payouts_enabled: false,
  details_submitted: false,
  requirements: {
    currently_due: [],
    past_due: [],
    eventually_due: [],
    pending_verification: [],
    disabled_reason: null,
  },
  ...over,
});

describe("deriveConnectStatus", () => {
  it("reports not_connected when there is no account at all", () => {
    const s = deriveConnectStatus(null);
    expect(s.status).toBe("not_connected");
    expect(s.needsOnboarding).toBe(true);
    expect(s.canAcceptPayments).toBe(false);
  });

  it("treats undefined the same as null", () => {
    expect(deriveConnectStatus(undefined).status).toBe("not_connected");
  });

  it("reports onboarding_incomplete for a freshly created account", () => {
    const s = deriveConnectStatus(
      account({
        requirements: {
          currently_due: ["external_account", "individual.verification.document"],
          past_due: [],
          disabled_reason: "requirements.past_due",
        },
      }),
    );
    expect(s.status).toBe("onboarding_incomplete");
    expect(s.needsOnboarding).toBe(true);
    expect(s.canAcceptPayments).toBe(false);
  });

  it("prioritises details_submitted=false over any enabled flags", () => {
    // Defensive: Stripe should not return this, but latching on charges_enabled
    // alone would mislabel a half-finished account as ready.
    const s = deriveConnectStatus(
      account({ charges_enabled: true, details_submitted: false }),
    );
    expect(s.status).toBe("onboarding_incomplete");
  });

  it("reports ready when charges and payouts are both enabled", () => {
    const s = deriveConnectStatus(
      account({
        charges_enabled: true,
        payouts_enabled: true,
        details_submitted: true,
      }),
    );
    expect(s.status).toBe("ready");
    expect(s.canAcceptPayments).toBe(true);
    expect(s.needsOnboarding).toBe(false);
  });

  it("reports ready_payouts_pending when charges work but payouts do not", () => {
    const s = deriveConnectStatus(
      account({
        charges_enabled: true,
        payouts_enabled: false,
        details_submitted: true,
      }),
    );
    expect(s.status).toBe("ready_payouts_pending");
    // Payments are safe to take even while payouts settle.
    expect(s.canAcceptPayments).toBe(true);
    expect(s.needsOnboarding).toBe(false);
  });

  it("reports restricted when Stripe is blocking on currently_due info", () => {
    const s = deriveConnectStatus(
      account({
        details_submitted: true,
        requirements: {
          currently_due: ["individual.id_number"],
          past_due: [],
          disabled_reason: "requirements.currently_due",
        },
      }),
    );
    expect(s.status).toBe("restricted");
    // Fixed by another trip through hosted onboarding.
    expect(s.needsOnboarding).toBe(true);
    expect(s.canAcceptPayments).toBe(false);
  });

  it("reports restricted when requirements are past_due", () => {
    const s = deriveConnectStatus(
      account({
        details_submitted: true,
        requirements: { past_due: ["individual.verification.document"] },
      }),
    );
    expect(s.status).toBe("restricted");
  });

  it("reports pending_verification when submitted with nothing outstanding", () => {
    const s = deriveConnectStatus(
      account({
        details_submitted: true,
        requirements: {
          currently_due: [],
          past_due: [],
          pending_verification: ["individual.verification.document"],
        },
      }),
    );
    expect(s.status).toBe("pending_verification");
    // Nothing for the therapist to do — must NOT be sent back to onboarding.
    expect(s.needsOnboarding).toBe(false);
    expect(s.canAcceptPayments).toBe(false);
  });

  it("tolerates a missing requirements object", () => {
    const s = deriveConnectStatus({ details_submitted: true });
    expect(s.status).toBe("pending_verification");
    expect(s.currentlyDue).toEqual([]);
  });

  it("coerces null/undefined booleans to false rather than truthy", () => {
    const s = deriveConnectStatus({
      charges_enabled: null,
      payouts_enabled: undefined,
      details_submitted: null,
    });
    expect(s.chargesEnabled).toBe(false);
    expect(s.payoutsEnabled).toBe(false);
    expect(s.detailsSubmitted).toBe(false);
  });

  it("surfaces disabled_reason for diagnostics", () => {
    const s = deriveConnectStatus(
      account({ requirements: { disabled_reason: "rejected.fraud" } }),
    );
    expect(s.disabledReason).toBe("rejected.fraud");
  });
});

describe("describeConnectStatus", () => {
  it("provides copy for every status", () => {
    const statuses = [
      "not_connected",
      "onboarding_incomplete",
      "pending_verification",
      "restricted",
      "ready_payouts_pending",
      "ready",
    ] as const;

    for (const status of statuses) {
      const copy = describeConnectStatus(status);
      expect(copy.label).toBeTruthy();
      expect(copy.detail).toBeTruthy();
      expect(["neutral", "warning", "success"]).toContain(copy.tone);
    }
  });

  it("marks only the fully-ready state as success", () => {
    expect(describeConnectStatus("ready").tone).toBe("success");
    expect(describeConnectStatus("restricted").tone).toBe("warning");
    expect(describeConnectStatus("not_connected").tone).toBe("neutral");
  });
});

describe("describeRequirement", () => {
  it("maps known Stripe requirement keys to plain language", () => {
    expect(describeRequirement("external_account")).toBe("Bank account details");
    expect(describeRequirement("individual.verification.document")).toBe(
      "Identity document",
    );
  });

  it("degrades gracefully for unknown keys instead of hiding them", () => {
    expect(describeRequirement("company.some_new_field")).toBe(
      "Company some new field",
    );
    expect(describeRequirement("totally_unknown")).toBe("Totally unknown");
  });
});

describe("describeOutstandingRequirements", () => {
  it("merges past_due and currently_due and de-duplicates labels", () => {
    const s = deriveConnectStatus(
      account({
        details_submitted: true,
        requirements: {
          // All three dob.* keys map to the same human label.
          currently_due: ["individual.dob.day", "individual.dob.month"],
          past_due: ["individual.dob.year", "external_account"],
        },
      }),
    );
    expect(describeOutstandingRequirements(s)).toEqual([
      "Date of birth",
      "Bank account details",
    ]);
  });

  it("returns an empty list when nothing is outstanding", () => {
    expect(describeOutstandingRequirements(deriveConnectStatus(null))).toEqual(
      [],
    );
  });
});
