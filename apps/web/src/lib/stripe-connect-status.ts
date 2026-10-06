/**
 * Stripe Connect status derivation.
 *
 * Deliberately dependency-free (no `stripe` import, no DB, no env): it maps the
 * handful of boolean/array fields Stripe reports on an Account onto the states
 * the therapist-facing UI needs. Keeping it pure makes it unit-testable without
 * a Stripe key, and keeps the "what does this mean?" judgement in exactly one
 * place instead of being re-derived ad hoc in routes, pages and webhooks.
 */

export type ConnectStatus =
  /** No Stripe account exists for this therapist yet. */
  | "not_connected"
  /** Account exists, but the therapist never finished Stripe's hosted form. */
  | "onboarding_incomplete"
  /** Form submitted; Stripe is reviewing and has not asked for anything else. */
  | "pending_verification"
  /** Form submitted, but Stripe needs more information before enabling charges. */
  | "restricted"
  /** Charges work; payouts to the bank account are not enabled yet. */
  | "ready_payouts_pending"
  /** Fully operational: can accept payments and receive payouts. */
  | "ready";

/**
 * The subset of `Stripe.Account` this module needs. Declared structurally so
 * tests can build fixtures without importing the Stripe SDK types.
 */
export interface AccountLike {
  charges_enabled?: boolean | null;
  payouts_enabled?: boolean | null;
  details_submitted?: boolean | null;
  requirements?: {
    currently_due?: string[] | null;
    past_due?: string[] | null;
    eventually_due?: string[] | null;
    pending_verification?: string[] | null;
    disabled_reason?: string | null;
  } | null;
}

export interface ConnectStatusSnapshot {
  status: ConnectStatus;
  chargesEnabled: boolean;
  payoutsEnabled: boolean;
  detailsSubmitted: boolean;
  /** Requirement keys Stripe wants now (drives "what do I do next?" copy). */
  currentlyDue: string[];
  pastDue: string[];
  pendingVerification: string[];
  disabledReason: string | null;
  /** True when the therapist must return to Stripe's hosted onboarding. */
  needsOnboarding: boolean;
  /** True when this account can actually be used as a charge destination. */
  canAcceptPayments: boolean;
}

function list(value: string[] | null | undefined): string[] {
  return Array.isArray(value) ? value : [];
}

export function deriveConnectStatus(
  account: AccountLike | null | undefined,
): ConnectStatusSnapshot {
  if (!account) {
    return {
      status: "not_connected",
      chargesEnabled: false,
      payoutsEnabled: false,
      detailsSubmitted: false,
      currentlyDue: [],
      pastDue: [],
      pendingVerification: [],
      disabledReason: null,
      needsOnboarding: true,
      canAcceptPayments: false,
    };
  }

  const chargesEnabled = account.charges_enabled === true;
  const payoutsEnabled = account.payouts_enabled === true;
  const detailsSubmitted = account.details_submitted === true;

  const currentlyDue = list(account.requirements?.currently_due);
  const pastDue = list(account.requirements?.past_due);
  const pendingVerification = list(account.requirements?.pending_verification);
  const disabledReason = account.requirements?.disabled_reason ?? null;

  let status: ConnectStatus;

  if (!detailsSubmitted) {
    // Stripe's hosted form was never completed, regardless of what else is set.
    status = "onboarding_incomplete";
  } else if (chargesEnabled && payoutsEnabled) {
    status = "ready";
  } else if (chargesEnabled) {
    // Charges work but money cannot leave yet — usually a bank account or
    // identity check still settling. Payments are safe to take.
    status = "ready_payouts_pending";
  } else if (pastDue.length > 0 || currentlyDue.length > 0) {
    // Stripe is actively blocking on information only the therapist can supply.
    status = "restricted";
  } else {
    // Submitted, nothing outstanding, still not enabled => Stripe is reviewing.
    status = "pending_verification";
  }

  return {
    status,
    chargesEnabled,
    payoutsEnabled,
    detailsSubmitted,
    currentlyDue,
    pastDue,
    pendingVerification,
    disabledReason,
    // "restricted" and "onboarding_incomplete" are both fixed by sending the
    // therapist back through an Account Link.
    needsOnboarding:
      status === "onboarding_incomplete" || status === "restricted",
    canAcceptPayments: chargesEnabled,
  };
}

const STATUS_COPY: Record<
  ConnectStatus,
  { label: string; detail: string; tone: "neutral" | "warning" | "success" }
> = {
  not_connected: {
    label: "Not set up",
    detail:
      "Set up payments to start receiving card payments from clients.",
    tone: "neutral",
  },
  onboarding_incomplete: {
    label: "Setup incomplete",
    detail:
      "Finish entering your details so you can get paid. Nothing is charged until setup is finished.",
    tone: "warning",
  },
  pending_verification: {
    label: "Verifying",
    detail:
      "Your information is being reviewed. This usually finishes within a few minutes — no action needed from you.",
    tone: "warning",
  },
  restricted: {
    label: "Action required",
    detail:
      "More information is needed before you can accept payments. Continue setup to provide it.",
    tone: "warning",
  },
  ready_payouts_pending: {
    label: "Accepting payments — bank deposit pending",
    detail:
      "You can take payments now. Deposits to your bank account are still being enabled.",
    tone: "warning",
  },
  ready: {
    label: "Ready to receive payments",
    detail:
      "You're all set. Client payments will be deposited to your bank account.",
    tone: "success",
  },
};

export function describeConnectStatus(status: ConnectStatus) {
  return STATUS_COPY[status];
}

/**
 * Human-readable rendering of Stripe's requirement keys
 * (e.g. "individual.verification.document" -> "Identity document").
 * Unknown keys degrade to a de-dotted, de-underscored form rather than being
 * hidden, so a therapist is never told "something is missing" with no hint.
 */
const REQUIREMENT_LABELS: Record<string, string> = {
  "individual.verification.document": "Identity document",
  "individual.verification.additional_document": "Additional identity document",
  "individual.id_number": "Social security or tax ID number",
  "individual.ssn_last_4": "Last 4 digits of SSN",
  "individual.dob.day": "Date of birth",
  "individual.dob.month": "Date of birth",
  "individual.dob.year": "Date of birth",
  "individual.address.line1": "Home address",
  "individual.first_name": "First name",
  "individual.last_name": "Last name",
  "individual.phone": "Phone number",
  "individual.email": "Email address",
  external_account: "Bank account details",
  "business_profile.url": "Business website",
  "business_profile.mcc": "Business category",
  "business_profile.product_description": "Description of your services",
  "tos_acceptance.date": "Accept payment terms",
  "tos_acceptance.ip": "Accept payment terms",
  "company.tax_id": "Business tax ID",
};

export function describeRequirement(key: string): string {
  const mapped = REQUIREMENT_LABELS[key];
  if (mapped) return mapped;
  const tail = key.split(".").slice(-2).join(" ");
  const spaced = tail.replace(/_/g, " ").trim();
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

/** Deduplicated, human-readable list of what Stripe is waiting on. */
export function describeOutstandingRequirements(
  snapshot: ConnectStatusSnapshot,
): string[] {
  const keys = [...snapshot.pastDue, ...snapshot.currentlyDue];
  const seen = new Set<string>();
  const out: string[] = [];
  for (const key of keys) {
    const label = describeRequirement(key);
    if (!seen.has(label)) {
      seen.add(label);
      out.push(label);
    }
  }
  return out;
}
