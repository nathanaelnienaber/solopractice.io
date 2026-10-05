import { describe, expect, it } from "vitest";
import {
  REMINDER_LEAD_HOURS,
  REMINDER_LEAD_MS,
  buildAppointmentReminderMessage,
  getAutoReminderWindowEnd,
} from "./appointment-reminders";

describe("appointment-reminders", () => {
  it("defaults lead time to 24 hours", () => {
    expect(REMINDER_LEAD_HOURS).toBe(24);
    expect(REMINDER_LEAD_MS).toBe(24 * 60 * 60 * 1000);
  });

  it("window end is now + lead ms", () => {
    const now = new Date("2026-06-01T12:00:00.000Z");
    expect(getAutoReminderWindowEnd(now).toISOString()).toBe(
      "2026-06-02T12:00:00.000Z",
    );
  });

  it("builds a CONFIRM-style reminder body", () => {
    const body = buildAppointmentReminderMessage({
      clientFirstName: "Alex",
      therapistFirstName: "Sam",
      therapistLastName: "Lee",
      scheduledAt: new Date("2026-06-02T15:30:00.000Z"),
    });
    expect(body).toContain("Hi Alex");
    expect(body).toContain("Sam Lee");
    expect(body).toContain("CONFIRM");
  });
});
