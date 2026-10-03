/**
 * Desktop API cross-tenant isolation.
 *
 * The desktop app authenticates with a per-therapist bearer key, not a session
 * cookie, so the cross-therapist-isolation suite (which mocks a session) does
 * not cover it. This file does.
 *
 * Regression under test: /api/consents/status/[clientId] previously accepted a
 * SINGLE environment-wide DESKTOP_API_KEY and then looked the client up by id
 * alone. Any therapist holding that shared secret could read any other
 * therapist's client consent record. The route must now resolve the therapist
 * from their own key and scope the query by therapist_id.
 *
 * As in cross-therapist-isolation.test.ts, the Drizzle `where` predicate is
 * evaluated against fixtures rather than stubbed out, so a route that drops the
 * therapist_id condition fails here instead of silently passing.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const THERAPIST_A = {
  id: "th_aaaaaaaaaaaaaaaaaaaa",
  email: "a@example.com",
  firstName: "Aisha",
  lastName: "Alpha",
  practiceName: "Alpha Therapy",
  credentials: "LMFT",
  desktopApiKey: "sp_desktop_AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
};
const THERAPIST_B = {
  id: "th_bbbbbbbbbbbbbbbbbbbb",
  email: "b@example.com",
  firstName: "Bruno",
  lastName: "Beta",
  practiceName: "Beta Counseling",
  credentials: "LCSW",
  desktopApiKey: "sp_desktop_BBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBB",
};

// A therapist who has never generated a desktop key. Guards against an empty
// or missing header matching a NULL column.
const THERAPIST_NO_KEY = {
  id: "th_cccccccccccccccccccc",
  email: "c@example.com",
  firstName: "Cleo",
  lastName: "Gamma",
  practiceName: null,
  credentials: "PsyD",
  desktopApiKey: null as string | null,
};

const B_CLIENT = {
  id: "cl_b_client_000000001",
  therapistId: THERAPIST_B.id,
  firstName: "Blake",
  lastName: "Client",
  email: "blake@example.com",
  phone: null,
  consents: [
    {
      consentType: "recording_consent",
      status: "signed",
      signedAt: new Date("2026-09-01T00:00:00Z"),
    },
    {
      consentType: "informed_consent",
      status: "signed",
      signedAt: new Date("2026-09-01T00:00:00Z"),
    },
  ],
};

const A_CLIENT = {
  id: "cl_a_client_000000001",
  therapistId: THERAPIST_A.id,
  firstName: "Avery",
  lastName: "Client",
  email: "avery@example.com",
  phone: null,
  consents: [
    {
      consentType: "recording_consent",
      status: "signed",
      signedAt: new Date("2026-09-02T00:00:00Z"),
    },
  ],
};

let lastPredicateColumns: string[] = [];

interface Condition {
  column: string;
  value: unknown;
}

/**
 * Walk the flat Drizzle `SQL.queryChunks` stream, pairing each Column with the
 * Param that follows it. Mirrors the matcher in cross-therapist-isolation.test
 * .ts; verified against drizzle-orm 0.38 rather than assumed.
 */
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

    if (typeof node.name === "string" && (node.columnType || node.table)) {
      pendingColumn = node.name;
      return;
    }

    if (Array.isArray(node.value)) {
      const text = node.value.join("");
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
  desktop_api_key: "desktopApiKey",
};

function rowMatches(row: Record<string, unknown>, predicate: unknown) {
  const conditions = extractConditions(predicate);
  lastPredicateColumns = conditions.map((c) => c.column);

  // An absent predicate means an unscoped query, so every row matches — which
  // is precisely the bug this file exists to catch.
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

vi.mock("@/db", async () => {
  const actual = await vi.importActual<typeof import("@/db")>("@/db");
  return {
    ...actual,
    db: {
      query: {
        clients: makeTableQuery([A_CLIENT, B_CLIENT]),
        therapists: makeTableQuery([
          THERAPIST_A,
          THERAPIST_B,
          THERAPIST_NO_KEY,
        ]),
      },
    },
  };
});

function statusRequest(clientId: string, apiKey?: string) {
  return new NextRequest(
    `https://www.solopractice.io/api/consents/status/${clientId}`,
    {
      method: "GET",
      headers: apiKey === undefined ? {} : { "X-Desktop-API-Key": apiKey },
    },
  );
}

async function getStatus(clientId: string, apiKey?: string) {
  const { GET } = await import(
    "@/app/api/consents/status/[clientId]/route"
  );
  return GET(statusRequest(clientId, apiKey), {
    params: Promise.resolve({ clientId }),
  });
}

beforeEach(() => {
  lastPredicateColumns = [];
  // The shared-secret the route used to trust. Set deliberately: if the route
  // still honours it, these tests must fail rather than pass by its absence.
  process.env.DESKTOP_API_KEY = "legacy-shared-desktop-key";
});

describe("GET /api/consents/status/[clientId] — desktop key is per-therapist", () => {
  it("THE LEAK: therapist A's key cannot read therapist B's client", async () => {
    const response = await getStatus(B_CLIENT.id, THERAPIST_A.desktopApiKey);

    expect(response.status).toBe(404);

    const body = await response.json();
    // No consent state of B's client may leak, not even booleans.
    expect(body).not.toHaveProperty("consents");
    expect(body).not.toHaveProperty("recordingConsentSigned");
    expect(JSON.stringify(body)).not.toContain(B_CLIENT.id);

    // Prove the 404 came from therapist scoping, not an empty fixture table.
    expect(lastPredicateColumns).toContain("therapist_id");
  });

  it("the legacy shared DESKTOP_API_KEY is no longer accepted", async () => {
    const response = await getStatus(
      B_CLIENT.id,
      process.env.DESKTOP_API_KEY,
    );

    expect(response.status).toBe(401);
    expect(await response.json()).not.toHaveProperty("consents");
  });

  it("the legacy x-api-key header is no longer accepted", async () => {
    const { GET } = await import(
      "@/app/api/consents/status/[clientId]/route"
    );
    const request = new NextRequest(
      `https://www.solopractice.io/api/consents/status/${B_CLIENT.id}`,
      {
        method: "GET",
        headers: { "x-api-key": process.env.DESKTOP_API_KEY as string },
      },
    );

    const response = await GET(request, {
      params: Promise.resolve({ clientId: B_CLIENT.id }),
    });

    expect(response.status).toBe(401);
  });

  it("therapist A's key CAN read therapist A's own client", async () => {
    const response = await getStatus(A_CLIENT.id, THERAPIST_A.desktopApiKey);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.clientId).toBe(A_CLIENT.id);
    expect(body.recordingConsentSigned).toBe(true);
    expect(lastPredicateColumns).toContain("therapist_id");
  });

  it("therapist B's key CAN read therapist B's own client", async () => {
    const response = await getStatus(B_CLIENT.id, THERAPIST_B.desktopApiKey);

    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.clientId).toBe(B_CLIENT.id);
  });

  it("returns 401 with no API key header at all", async () => {
    const response = await getStatus(B_CLIENT.id);
    expect(response.status).toBe(401);
  });

  it("returns 401 for an unknown key", async () => {
    const response = await getStatus(B_CLIENT.id, "sp_desktop_not_a_real_key");
    expect(response.status).toBe(401);
  });

  it("an empty key does not match a therapist with no key provisioned", async () => {
    const response = await getStatus(B_CLIENT.id, "");
    expect(response.status).toBe(401);
  });

  it("returns 404 for a client id that does not exist anywhere", async () => {
    const response = await getStatus(
      "cl_nonexistent_00001",
      THERAPIST_A.desktopApiKey,
    );
    expect(response.status).toBe(404);
  });
});

describe("GET /api/desktop/sync — unchanged per-therapist scoping", () => {
  it("returns only therapist A's clients", async () => {
    const { GET } = await import("@/app/api/desktop/sync/route");
    const response = await GET(
      new NextRequest("https://www.solopractice.io/api/desktop/sync", {
        headers: { "X-Desktop-API-Key": THERAPIST_A.desktopApiKey },
      }),
    );

    expect(response.status).toBe(200);
    const body = await response.json();

    expect(body.clients.map((c: { id: string }) => c.id)).toEqual([
      A_CLIENT.id,
    ]);
    expect(JSON.stringify(body)).not.toContain(B_CLIENT.id);
    expect(JSON.stringify(body)).not.toContain(B_CLIENT.email);
    expect(body.therapist.id).toBe(THERAPIST_A.id);
  });

  it("POST refuses to sync a client belonging to another therapist", async () => {
    const { POST } = await import("@/app/api/desktop/sync/route");
    const response = await POST(
      new NextRequest("https://www.solopractice.io/api/desktop/sync", {
        method: "POST",
        headers: {
          "X-Desktop-API-Key": THERAPIST_A.desktopApiKey,
          "content-type": "application/json",
        },
        body: JSON.stringify({ clientId: B_CLIENT.id }),
      }),
    );

    expect(response.status).toBe(404);
    expect(lastPredicateColumns).toContain("therapist_id");
  });
});
