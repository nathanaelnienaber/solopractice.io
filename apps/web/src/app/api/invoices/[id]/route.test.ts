/**
 * Route-level tests for PATCH / DELETE /api/invoices/[id].
 *
 * Draft-only edit guard: therapists may change amount / description / due
 * date while status === "draft". Sent and paid invoices must be refused.
 *
 * Delete: unpaid invoices (draft/sent/…) may be removed; paid and refunded
 * invoices are kept as payment history.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const THERAPIST = {
  id: "th_abc",
  email: "therapist@example.com",
  firstName: "Ada",
  lastName: "Therapist",
};

const DRAFT_INVOICE = {
  id: "inv_draft_0000000001",
  therapistId: THERAPIST.id,
  clientId: "cl_000000000000000001",
  amountCents: 15_000,
  description: "Therapy session",
  status: "draft" as string,
  dueDate: new Date("2026-11-01T00:00:00.000Z"),
};

let invoiceRow: Record<string, unknown> | undefined = DRAFT_INVOICE;
let sessionTherapist: typeof THERAPIST | null = THERAPIST;

const updateSetWhereMock = vi.fn();
const deleteWhereMock = vi.fn();
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
      delete: () => ({
        where: (cond: unknown) => {
          deleteWhereMock(cond);
          return Promise.resolve();
        },
      }),
    },
  };
});

vi.mock("@/lib/auth", () => ({
  getSessionTherapist: vi.fn(async () => sessionTherapist),
}));

vi.mock("@/lib/web-safety", async () => {
  const actual = await vi.importActual<typeof import("@/lib/web-safety")>(
    "@/lib/web-safety"
  );
  return actual;
});

async function patchInvoice(
  id: string,
  body: Record<string, unknown>,
) {
  const { PATCH } = await import("./route");
  const request = new NextRequest(
    `https://www.solopractice.io/api/invoices/${id}`,
    {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    }
  );
  return PATCH(request, { params: Promise.resolve({ id }) });
}

async function deleteInvoice(id: string) {
  const { DELETE } = await import("./route");
  const request = new NextRequest(
    `https://www.solopractice.io/api/invoices/${id}`,
    { method: "DELETE" }
  );
  return DELETE(request, { params: Promise.resolve({ id }) });
}

beforeEach(() => {
  vi.clearAllMocks();
  invoiceRow = { ...DRAFT_INVOICE };
  sessionTherapist = THERAPIST;
});

describe("PATCH /api/invoices/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    sessionTherapist = null;
    const res = await patchInvoice(DRAFT_INVOICE.id, {
      amountCents: 20_000,
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when invoice is missing", async () => {
    invoiceRow = undefined;
    const res = await patchInvoice("inv_missing", { amountCents: 20_000 });
    expect(res.status).toBe(404);
  });

  it("updates draft amount, description, and due date", async () => {
    const res = await patchInvoice(DRAFT_INVOICE.id, {
      amountCents: 20_000,
      description: "Updated session",
      dueDate: "2026-12-15",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.invoice.amountCents).toBe(20_000);
    expect(data.invoice.description).toBe("Updated session");
    expect(data.invoice.status).toBe("draft");
    expect(updateSetWhereMock).toHaveBeenCalled();
    const [values] = updateSetWhereMock.mock.calls[0];
    expect(values).toMatchObject({
      amountCents: 20_000,
      description: "Updated session",
    });
    expect(values.dueDate).toBeInstanceOf(Date);
  });

  it("refuses sent invoices", async () => {
    invoiceRow = { ...DRAFT_INVOICE, status: "sent" };
    const res = await patchInvoice(DRAFT_INVOICE.id, { amountCents: 20_000 });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/draft/i);
    expect(updateSetWhereMock).not.toHaveBeenCalled();
  });

  it("refuses paid invoices", async () => {
    invoiceRow = { ...DRAFT_INVOICE, status: "paid" };
    const res = await patchInvoice(DRAFT_INVOICE.id, {
      description: "Nope",
    });
    expect(res.status).toBe(400);
    expect(updateSetWhereMock).not.toHaveBeenCalled();
  });

  it("rejects empty patch body", async () => {
    const res = await patchInvoice(DRAFT_INVOICE.id, {});
    expect(res.status).toBe(400);
  });

  it("rejects non-positive amountCents", async () => {
    const res = await patchInvoice(DRAFT_INVOICE.id, { amountCents: 0 });
    expect(res.status).toBe(400);
  });
});

describe("DELETE /api/invoices/[id]", () => {
  it("returns 401 when unauthenticated", async () => {
    sessionTherapist = null;
    const res = await deleteInvoice(DRAFT_INVOICE.id);
    expect(res.status).toBe(401);
  });

  it("returns 404 when invoice is missing", async () => {
    invoiceRow = undefined;
    const res = await deleteInvoice("inv_missing");
    expect(res.status).toBe(404);
  });

  it("deletes draft invoices", async () => {
    const res = await deleteInvoice(DRAFT_INVOICE.id);
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.success).toBe(true);
    expect(deleteWhereMock).toHaveBeenCalled();
  });

  it("deletes sent invoices", async () => {
    invoiceRow = { ...DRAFT_INVOICE, status: "sent" };
    const res = await deleteInvoice(DRAFT_INVOICE.id);
    expect(res.status).toBe(200);
    expect(deleteWhereMock).toHaveBeenCalled();
  });

  it("refuses paid invoices", async () => {
    invoiceRow = { ...DRAFT_INVOICE, status: "paid" };
    const res = await deleteInvoice(DRAFT_INVOICE.id);
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.error).toMatch(/paid/i);
    expect(deleteWhereMock).not.toHaveBeenCalled();
  });

  it("refuses refunded invoices", async () => {
    invoiceRow = { ...DRAFT_INVOICE, status: "refunded" };
    const res = await deleteInvoice(DRAFT_INVOICE.id);
    expect(res.status).toBe(400);
    expect(deleteWhereMock).not.toHaveBeenCalled();
  });
});
