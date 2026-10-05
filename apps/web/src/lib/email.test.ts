/**
 * sendEmail must never report success when Resend is unavailable.
 * A silent stub previously let invoice Send mark rows as "sent" with no
 * outbound message. Success also requires a real Resend message id.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const sendMock = vi.fn();
vi.mock("resend", () => ({
  Resend: vi.fn().mockImplementation(() => ({
    emails: { send: sendMock },
  })),
}));

describe("sendEmail", () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.EMAIL_FROM;

  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();
    process.env.EMAIL_FROM = "noreply@solopractice.io";
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalKey;
    }
    if (originalFrom === undefined) {
      delete process.env.EMAIL_FROM;
    } else {
      process.env.EMAIL_FROM = originalFrom;
    }
  });

  it("throws when RESEND_API_KEY is missing instead of stubbing success", async () => {
    delete process.env.RESEND_API_KEY;

    const { sendEmail } = await import("./email");

    await expect(
      sendEmail({
        to: "client@example.com",
        subject: "Invoice",
        html: "<p>Pay</p>",
      })
    ).rejects.toThrow(/RESEND_API_KEY missing/i);

    expect(sendMock).not.toHaveBeenCalled();
  });

  it("throws when Resend returns an error payload", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    sendMock.mockResolvedValue({
      data: null,
      error: { name: "validation_error", message: "Domain not verified" },
    });

    const { sendEmail } = await import("./email");

    await expect(
      sendEmail({
        to: "client@example.com",
        subject: "Invoice",
        html: "<p>Pay</p>",
      })
    ).rejects.toThrow(/Resend send failed/i);
  });

  it("throws when Resend returns no message id", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    sendMock.mockResolvedValue({
      data: {},
      error: null,
    });

    const { sendEmail } = await import("./email");

    await expect(
      sendEmail({
        to: "client@example.com",
        subject: "Invoice",
        html: "<p>Pay</p>",
      })
    ).rejects.toThrow(/no message id/i);
  });

  it("returns Resend data on success and omits undefined text", async () => {
    process.env.RESEND_API_KEY = "re_test_key";
    sendMock.mockResolvedValue({
      data: { id: "email_abc" },
      error: null,
    });

    const { sendEmail } = await import("./email");
    const result = await sendEmail({
      to: "client@example.com",
      subject: "Invoice",
      html: "<p>Pay</p>",
    });

    expect(result).toEqual({ id: "email_abc" });
    expect(sendMock).toHaveBeenCalledTimes(1);
    expect(sendMock.mock.calls[0][0]).toEqual({
      from: "noreply@solopractice.io",
      to: "client@example.com",
      subject: "Invoice",
      html: "<p>Pay</p>",
    });
    expect(sendMock.mock.calls[0][0]).not.toHaveProperty("text");
  });
});

describe("sendInvoiceNotification", () => {
  const originalKey = process.env.RESEND_API_KEY;
  const originalFrom = process.env.EMAIL_FROM;

  beforeEach(() => {
    vi.resetModules();
    sendMock.mockReset();
    process.env.RESEND_API_KEY = "re_test_key";
    process.env.EMAIL_FROM = "noreply@solopractice.io";
    sendMock.mockResolvedValue({
      data: { id: "email_inv" },
      error: null,
    });
  });

  afterEach(() => {
    if (originalKey === undefined) {
      delete process.env.RESEND_API_KEY;
    } else {
      process.env.RESEND_API_KEY = originalKey;
    }
    if (originalFrom === undefined) {
      delete process.env.EMAIL_FROM;
    } else {
      process.env.EMAIL_FROM = originalFrom;
    }
  });

  it("uses consent-like subject without dollar amounts and includes text/plain", async () => {
    const { sendInvoiceNotification } = await import("./email");

    await sendInvoiceNotification(
      "client@example.com",
      "Casey",
      "Ada Therapist",
      150,
      "11/1/2026",
      "https://www.solopractice.io/client/pay/inv_1"
    );

    const payload = sendMock.mock.calls[0][0];
    expect(payload.subject).toBe("Ada Therapist - Your invoice is ready");
    expect(payload.subject).not.toMatch(/\$/);
    expect(payload.html).toMatch(/View invoice/);
    expect(payload.html).not.toMatch(/Pay Now/);
    expect(payload.text).toMatch(/View invoice:/);
    expect(payload.text).toMatch(/150\.00 USD/);
  });
});
