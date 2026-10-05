import { describe, it, expect, vi, afterEach } from "vitest";
import {
  displayInvoiceStatus,
  canEmailInvoiceStatus,
} from "./invoice-status";

describe("displayInvoiceStatus", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("keeps paid/draft/cancelled unchanged even if due date is past", () => {
    vi.setSystemTime(new Date("2026-10-10T12:00:00"));
    expect(displayInvoiceStatus("paid", "2026-10-01")).toBe("paid");
    expect(displayInvoiceStatus("draft", "2026-10-01")).toBe("draft");
    expect(displayInvoiceStatus("cancelled", "2026-10-01")).toBe("cancelled");
  });

  it("shows overdue for sent/viewed when due date is before today", () => {
    vi.setSystemTime(new Date("2026-10-10T12:00:00"));
    expect(displayInvoiceStatus("sent", "2026-10-09")).toBe("overdue");
    expect(displayInvoiceStatus("viewed", "2026-10-01")).toBe("overdue");
  });

  it("does not mark overdue on the due date itself", () => {
    vi.setSystemTime(new Date("2026-10-10T23:59:00"));
    expect(displayInvoiceStatus("sent", "2026-10-10")).toBe("sent");
  });

  it("keeps sent when due date is in the future", () => {
    vi.setSystemTime(new Date("2026-10-05T12:00:00"));
    expect(displayInvoiceStatus("sent", "2026-10-20")).toBe("sent");
  });
});

describe("canEmailInvoiceStatus", () => {
  it("allows draft, sent, viewed, overdue", () => {
    expect(canEmailInvoiceStatus("draft")).toBe(true);
    expect(canEmailInvoiceStatus("sent")).toBe(true);
    expect(canEmailInvoiceStatus("viewed")).toBe(true);
    expect(canEmailInvoiceStatus("overdue")).toBe(true);
  });

  it("refuses paid and cancelled", () => {
    expect(canEmailInvoiceStatus("paid")).toBe(false);
    expect(canEmailInvoiceStatus("cancelled")).toBe(false);
  });
});
