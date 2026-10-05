/**
 * Route-level tests for POST /api/invoices/[id]/send.
 *
 * Contract: status flips to "sent" only after Resend accepts the message.
 * Failures (missing key, Resend error, non-emailable status) must return a
 * clear error and leave the invoice untouched — the therapist UI surfaces that.
 * Sent/viewed/overdue may be resent; paid/cancelled may not.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const THERAPIST = {
  id: "th_abc",
  email: "therapist@example.com",
  firstName: "Ada",
  lastName: "Therapist",
};

const CLIENT = {
  id: "cl_000000000000000001",
  email: "client@example.com",
  firstName: "Casey",
  lastName: "Client",
};

const DRAFT_INVOICE = {
  id: "inv_draft_0000000001",
  therapistId: THERAPIST.id,
  clientId: CLIENT.id,
  amountCents: 15_000,
  description: "Therapy session",
  status: "draft" as string,
  dueDate: new Date("2026-11-01T00:00:00.000Z"),
  client: CLIENT,
};

let invoiceRow: Record<string, unknown> | undefined = {
  ...DRAFT_INVOICE,
};
let sessionTherapist: typeof THERAPIST | null = THERAPIST;

const updateSetWhereMock = vi.fn();
const sendInvoiceNotificationMock = vi.fn();

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

vi.mock("@/lib/auth", () => ({
  getSessionTherapist: vi.fn(async () => sessionTherapist),
}));

vi.mock("@/lib/email", () => ({
  sendInvoiceNotification: (...args: unknown[]) =>
    sendInvoiceNotificationMock(...args),
}));

async function sendInvoice(id: string) {
  const { POST } = await import("./route");
  const request = new NextRequest(
    `https://www.solopractice.io/api/invoices/${id}/send`,
    { method: "POST" }
  );
  return POST(request, { params: Promise.resolve({ id }) });
}

describe("POST /api/invoices/[id]/send", () => {
  beforeEach(() => {
    vi.resetModules();
    updateSetWhereMock.mockReset();
    sendInvoiceNotificationMock.mockReset();
    invoiceRow = { ...DRAFT_INVOICE, client: { ...CLIENT } };
    sessionTherapist = THERAPIST;
    sendInvoiceNotificationMock.mockResolvedValue({ id: "email_ok" });
  });

  it("marks sent only after Resend succeeds and returns to + emailId", async () => {
    const response = await sendInvoice(DRAFT_INVOICE.id);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.to).toBe(CLIENT.email);
    expect(body.emailId).toBe("email_ok");
    expect(sendInvoiceNotificationMock).toHaveBeenCalledTimes(1);
    expect(sendInvoiceNotificationMock).toHaveBeenCalledWith(
      CLIENT.email,
      CLIENT.firstName,
      "Ada Therapist",
      150,
      expect.any(String),
      expect.stringContaining(`/client/pay/${DRAFT_INVOICE.id}`),
      { replyTo: THERAPIST.email }
    );
    expect(updateSetWhereMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent" }),
      expect.anything()
    );
  });

  it("resends for already-sent invoices without changing status away from sent", async () => {
    invoiceRow = {
      ...DRAFT_INVOICE,
      status: "sent",
      client: { ...CLIENT },
    };

    const response = await sendInvoice(DRAFT_INVOICE.id);
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.to).toBe(CLIENT.email);
    expect(sendInvoiceNotificationMock).toHaveBeenCalledTimes(1);
    expect(updateSetWhereMock).toHaveBeenCalledWith(
      expect.objectContaining({ status: "sent" }),
      expect.anything()
    );
  });

  it("returns a clear error and does not mark sent when Resend fails", async () => {
    sendInvoiceNotificationMock.mockRejectedValue(
      new Error("Resend send failed (validation_error): Domain not verified")
    );

    const response = await sendInvoice(DRAFT_INVOICE.id);
    const body = await response.json();

    expect(response.status).toBe(502);
    expect(body.error).toMatch(/Resend send failed/i);
    expect(updateSetWhereMock).not.toHaveBeenCalled();
  });

  it("refuses paid invoices without emailing", async () => {
    invoiceRow = {
      ...DRAFT_INVOICE,
      status: "paid",
      client: { ...CLIENT },
    };

    const response = await sendInvoice(DRAFT_INVOICE.id);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toMatch(/paid/i);
    expect(sendInvoiceNotificationMock).not.toHaveBeenCalled();
    expect(updateSetWhereMock).not.toHaveBeenCalled();
  });

  it("returns 401 when unauthenticated", async () => {
    sessionTherapist = null;

    const response = await sendInvoice(DRAFT_INVOICE.id);
    expect(response.status).toBe(401);
    expect(sendInvoiceNotificationMock).not.toHaveBeenCalled();
  });
});
