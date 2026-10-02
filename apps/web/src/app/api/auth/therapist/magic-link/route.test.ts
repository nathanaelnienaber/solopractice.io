import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

// `db` connects lazily (see src/db/index.ts), but importing the real schema
// is still safe — pgTable() just builds metadata, no I/O. We only override
// the `db` client itself so the route never needs a real DATABASE_URL.
const findFirstMock = vi.fn();
vi.mock("@/db", async () => {
  const actual = await vi.importActual<typeof import("@/db")>("@/db");
  return {
    ...actual,
    db: {
      query: {
        therapists: {
          findFirst: findFirstMock,
        },
      },
    },
  };
});

// Mock the Resend SDK at the point sendEmail() calls it, so we can simulate
// both a successful send and a failed one without hitting the network.
const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe("POST /api/auth/therapist/magic-link", () => {
  const existingTherapist = {
    id: "th_test123",
    email: "therapist@example.com",
    firstName: "Test",
    lastName: "Therapist",
  };

  beforeEach(() => {
    vi.resetModules();
    findFirstMock.mockReset();
    sendMock.mockReset();
    findFirstMock.mockResolvedValue(existingTherapist);
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "noreply@solopractice.io";
  });

  function makeRequest(email: string) {
    return new NextRequest("http://localhost:3847/api/auth/therapist/magic-link", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email }),
    });
  }

  it("returns a non-200 response with a useful error when Resend fails to send", async () => {
    // Simulates Resend's documented failure mode: the SDK resolves (never
    // rejects) with { data: null, error }, e.g. because the sending domain
    // isn't verified yet.
    sendMock.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Domain not verified" },
    });

    const { POST } = await import("./route");
    const response = await POST(makeRequest("therapist@example.com"));
    const body = await response.json();

    expect(response.status).not.toBe(200);
    expect(response.status).toBe(500);
    expect(body.error).toBeTruthy();
    expect(typeof body.error).toBe("string");
    expect(sendMock).toHaveBeenCalledTimes(1);
  });

  it("returns 200 when Resend reports success", async () => {
    sendMock.mockResolvedValue({
      data: { id: "email_abc123" },
      error: null,
    });

    const { POST } = await import("./route");
    const response = await POST(makeRequest("therapist@example.com"));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
  });
});
