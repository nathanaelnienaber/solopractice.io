/**
 * sendEmail must never report success when Resend is unavailable.
 * A silent stub previously let invoice Send mark rows as "sent" with no
 * outbound message.
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

  it("returns Resend data on success", async () => {
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
  });
});
