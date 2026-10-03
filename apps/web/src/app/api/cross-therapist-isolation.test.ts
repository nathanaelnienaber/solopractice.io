/**
 * Cross-therapist isolation tests.
 *
 * Gilfoyle's finding had two halves. The first (unsigned session cookie) is
 * covered in lib/session-token.test.ts. This file covers the second: routes
 * that check "is there a session" but not "does this resource belong to THIS
 * session's therapist".
 *
 * These drive the real route handlers against a stubbed Drizzle query builder
 * that enforces the therapistId predicate the way Postgres would, so a route
 * that forgets to scope by therapist fails here.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { NextRequest } from "next/server";

const THERAPIST_A = {
  id: "th_aaaaaaaaaaaaaaaaaaaa",
  email: "a@example.com",
  firstName: "Aisha",
  lastName: "Alpha",
  stripeConnectedAccountId: "acct_A",
  stripeOnboardingComplete: true,
};
const THERAPIST_B = {
  id: "th_bbbbbbbbbbbbbbbbbbbb",
  email: "b@example.com",
  firstName: "Bruno",
  lastName: "Beta",
  stripeConnectedAccountId: "acct_B",
  stripeOnboardingComplete: true,
};

// Therapist B's data. Therapist A must never reach any of it.
const B_CLIENT = {
  id: "cl_b_client_000000001",
  therapistId: THERAPIST_B.id,
  firstName: "Blake",
  lastName: "Client",
  email: "blake@example.com",
  phone: null,
  consents: [],
};
const B_INVOICE = {
  id: "inv_b_invoice_0000001",
  therapistId: THERAPIST_B.id,
  clientId: B_CLIENT.id,
  amountCents: 25_000,
  description: "B's session",
  status: "sent" as string,
  dueDate: new Date("2026-11-01"),
  sentAt: null,
  paidAt: null,
  client: B_CLIENT,
  therapist: THERAPIST_B,
};

const TABLES = {
  clients: [B_CLIENT],
  invoices: [B_INVOICE],
};

/**
 * Captures the `where` predicate Drizzle was handed and evaluates it against
 * our fixtures. We record the columns compared so a test can assert that the
 * route actually constrained on therapist_id rather than just id.
 *
 * Drizzle builds an `SQL` object whose `queryChunks` is a FLAT stream, e.g.
 * for and(eq(id,'x'), eq(therapistId,'y')):
 *   "(" | "" | Column(id) | " = " | Param('x') | "" | " and " | ...
 * so we walk the chunks and pair each Column with the Param that follows it.
 * Verified against drizzle-orm 0.38 rather than assumed.
 */
let lastPredicateColumns: string[] = [];

interface Condition {
  column: string;
  value: unknown;
}

function extractConditions(predicate: unknown): Condition[] {
  const conditions: Condition[] = [];
  let pendingColumn: string | null = null;
  let sawDisjunction = false;

  function walk(node: any): void {
    if (!node || typeof node !== "object") return;

    if (Array.isArray(node.queryChunks)) {
      for (const chunk of node.queryChunks) walk(chunk);
      return;
    }

    const ctor = node.constructor?.name;

    if (ctor === "Param") {
      if (pendingColumn !== null) {
        conditions.push({ column: pendingColumn, value: node.value });
        pendingColumn = null;
      }
      return;
    }

    // A Drizzle column instance (PgText, PgTimestamp, ...).
    if (typeof node.name === "string" && (node.columnType || node.table)) {
      pendingColumn = node.name;
      return;
    }

    if (Array.isArray(node.value)) {
      const text = node.value.join("");
      // Guard: this matcher only models conjunctions. If a route ever uses OR,
      // fail loudly instead of silently reporting a pass.
      if (/\bor\b/i.test(text)) sawDisjunction = true;
    }
  }

  walk(predicate);

  if (sawDisjunction) {
    throw new Error(
      "Test matcher only supports AND predicates; saw a disjunction.",
    );
  }
  return conditions;
}

const COLUMN_TO_FIELD: Record<string, string> = {
  id: "id",
  therapist_id: "therapistId",
  client_id: "clientId",
};

function rowMatches(row: Record<string, unknown>, predicate: unknown) {
  const conditions = extractConditions(predicate);
  lastPredicateColumns = conditions.map((c) => c.column);

  // No predicate at all means an unscoped query: every row matches, which is
  // exactly the bug these tests hunt for.
  return conditions.every((c) => {
    const field = COLUMN_TO_FIELD[c.column] ?? c.column;
    return row[field] === c.value;
  });
}

function makeTableQuery(rows: Record<string, unknown>[]) {
  return {
    findFirst: vi.fn(async (args?: { where?: unknown }) => {
      return rows.find((r) => rowMatches(r, args?.where)) ?? undefined;
    }),
    findMany: vi.fn(async (args?: { where?: unknown }) => {
      return rows.filter((r) => rowMatches(r, args?.where));
    }),
  };
}

const updateWhereSpy = vi.fn();

vi.mock("@/db", async () => {
  const actual = await vi.importActual<typeof import("@/db")>("@/db");
  return {
    ...actual,
    db: {
      query: {
        clients: makeTableQuery(TABLES.clients),
        invoices: makeTableQuery(TABLES.invoices),
        therapists: makeTableQuery([THERAPIST_A, THERAPIST_B]),
      },
      update: () => ({
        set: () => ({
          where: (...args: unknown[]) => {
            updateWhereSpy(...args);
            return Promise.resolve();
          },
        }),
      }),
      insert: () => ({
        values: () => Promise.resolve(),
      }),
    },
  };
});

// Session is therapist A for every test in this file.
const getSessionTherapistMock = vi.fn();
vi.mock("@/lib/auth", async () => {
  const actual = await vi.importActual<typeof import("@/lib/auth")>("@/lib/auth");
  return {
    ...actual,
    getSessionTherapist: getSessionTherapistMock,
  };
});

// Never send real email or hit Stripe from these tests.
const sendConsentInviteMock = vi.fn().mockResolvedValue(undefined);
const sendInvoiceNotificationMock = vi.fn().mockResolvedValue(undefined);
vi.mock("@/lib/email", () => ({
  sendConsentInvite: sendConsentInviteMock,
  sendInvoiceNotification: sendInvoiceNotificationMock,
  sendMagicLink: vi.fn(),
}));

const createCheckoutSessionMock = vi.fn();
vi.mock("@/lib/stripe", async () => {
  const actual = await vi.importActual<typeof import("@/lib/stripe")>(
    "@/lib/stripe",
  );
  return {
    ...actual,
    createCheckoutSession: createCheckoutSessionMock,
    isStripeConfigured: () => true,
    assertNonLiveOrAllowed: () => undefined,
    getStripeKeyMode: () => "test",
    retrieveAccountOrNull: vi.fn().mockResolvedValue({ id: "acct_A" }),
    createConnectedAccount: vi.fn().mockResolvedValue({ id: "acct_A" }),
    createConnectAccountLink: vi.fn().mockResolvedValue("https://stripe/onboard"),
  };
});

vi.mock("@/lib/web-safety", () => ({
  validateWebSafeRequest: vi.fn(async (req: NextRequest) => ({
    valid: true,
    body: await req.json().catch(() => ({})),
  })),
  webSafetyErrorResponse: () => new Response("unsafe", { status: 400 }),
}));

beforeEach(() => {
  lastPredicateColumns = [];
  updateWhereSpy.mockClear();
  createCheckoutSessionMock.mockReset();
  sendConsentInviteMock.mockClear();
  sendInvoiceNotificationMock.mockClear();
  getSessionTherapistMock.mockResolvedValue({ ...THERAPIST_A });
  process.env.SESSION_SECRET = "test-secret-at-least-32-chars-long-padding";
});

afterEach(() => {
  vi.resetModules();
});

describe("invoices: therapist A cannot reach therapist B's invoice", () => {
  it("GET /api/invoices does not list B's invoices", async () => {
    const { GET } = await import("@/app/api/invoices/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.invoices).toEqual([]);
    // Prove the scoping was by therapist, not just an empty fixture.
    expect(lastPredicateColumns).toContain("therapist_id");
  });

  it("POST /api/invoices/[id]/send returns 404 for B's invoice", async () => {
    const { POST } = await import("@/app/api/invoices/[id]/send/route");

    const request = new NextRequest(
      `http://localhost:3847/api/invoices/${B_INVOICE.id}/send`,
      { method: "POST" },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: B_INVOICE.id }),
    });

    expect(response.status).toBe(404);
    // The real damage would be emailing B's client; assert we never did.
    expect(sendInvoiceNotificationMock).not.toHaveBeenCalled();
    expect(lastPredicateColumns).toContain("therapist_id");
  });

  it("POST /api/invoices refuses to bill a client that belongs to B", async () => {
    const { POST } = await import("@/app/api/invoices/route");

    const request = new NextRequest("http://localhost:3847/api/invoices", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        clientId: B_CLIENT.id,
        amountCents: 10_000,
        description: "attempted cross-tenant invoice",
        dueDate: "2026-12-01",
      }),
    });

    const response = await POST(request);
    expect(response.status).toBe(404);
    expect(lastPredicateColumns).toContain("therapist_id");
  });
});

describe("clients: therapist A cannot reach therapist B's client", () => {
  it("GET /api/clients does not list B's clients", async () => {
    const { GET } = await import("@/app/api/clients/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.clients).toEqual([]);
    expect(lastPredicateColumns).toContain("therapist_id");
  });

  it("POST /api/clients/[id]/send-consent-invite returns 404 for B's client", async () => {
    const { POST } = await import(
      "@/app/api/clients/[id]/send-consent-invite/route"
    );

    const request = new NextRequest(
      `http://localhost:3847/api/clients/${B_CLIENT.id}/send-consent-invite`,
      { method: "POST" },
    );
    const response = await POST(request, {
      params: Promise.resolve({ id: B_CLIENT.id }),
    });

    expect(response.status).toBe(404);
    // Critically: no consent invite email to B's client, and no token rotation.
    expect(sendConsentInviteMock).not.toHaveBeenCalled();
    expect(updateWhereSpy).not.toHaveBeenCalled();
    expect(lastPredicateColumns).toContain("therapist_id");
  });
});

describe("stripe connect: the account id is never taken from the request", () => {
  it("ignores an attacker-supplied accountId in the body", async () => {
    const stripe = await import("@/lib/stripe");
    const { POST } = await import("@/app/api/stripe/connect/route");

    const request = new NextRequest("http://localhost:3847/api/stripe/connect", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Therapist A tries to mint an onboarding link for B's account.
      body: JSON.stringify({ accountId: THERAPIST_B.stripeConnectedAccountId }),
    });

    const response = await POST(request);
    const body = await response.json();

    expect(response.status).toBe(200);
    // Must be A's own account, never the one supplied in the body.
    expect(body.accountId).toBe(THERAPIST_A.stripeConnectedAccountId);
    expect(body.accountId).not.toBe(THERAPIST_B.stripeConnectedAccountId);

    expect(stripe.createConnectAccountLink).toHaveBeenCalledWith(
      THERAPIST_A.stripeConnectedAccountId,
      expect.any(String),
      expect.any(String),
    );
  });

  it("GET /api/stripe/connect/status reports only the session therapist's account", async () => {
    const { GET } = await import("@/app/api/stripe/connect/status/route");
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(JSON.stringify(body)).not.toContain(
      THERAPIST_B.stripeConnectedAccountId,
    );
  });
});

describe("unauthenticated session is rejected on therapist routes", () => {
  beforeEach(() => {
    getSessionTherapistMock.mockResolvedValue(null);
  });

  it("GET /api/invoices returns 401 with no valid session", async () => {
    const { GET } = await import("@/app/api/invoices/route");
    expect((await GET()).status).toBe(401);
  });

  it("GET /api/clients returns 401 with no valid session", async () => {
    const { GET } = await import("@/app/api/clients/route");
    expect((await GET()).status).toBe(401);
  });

  it("POST /api/stripe/connect returns 401 with no valid session", async () => {
    const { POST } = await import("@/app/api/stripe/connect/route");
    const request = new NextRequest("http://localhost:3847/api/stripe/connect", {
      method: "POST",
    });
    expect((await POST(request)).status).toBe(401);
  });
});

describe("checkout refuses invoices that were never sent", () => {
  it("does not create a Stripe session for a draft invoice", async () => {
    const draft = { ...B_INVOICE, id: "inv_draft_00000000001", status: "draft" };
    TABLES.invoices.push(draft);

    try {
      const { POST } = await import("@/app/api/invoices/[id]/checkout/route");
      const request = new NextRequest(
        `http://localhost:3847/api/invoices/${draft.id}/checkout`,
        { method: "POST" },
      );
      const response = await POST(request, {
        params: Promise.resolve({ id: draft.id }),
      });

      expect(response.status).toBe(404);
      expect(createCheckoutSessionMock).not.toHaveBeenCalled();
      // And the status must not have been mutated to "sent".
      expect(updateWhereSpy).not.toHaveBeenCalled();
    } finally {
      TABLES.invoices.pop();
    }
  });
});
