import { describe, it, expect } from "vitest";
import {
  getMonthGridDays,
  getVisibleRange,
  getWeekDays,
  shiftAnchor,
} from "./appointment-calendar";

describe("appointment-calendar", () => {
  it("returns seven days starting Sunday for a mid-week anchor", () => {
    const anchor = new Date(2026, 9, 8); // Wed Oct 8 2026
    const days = getWeekDays(anchor);
    expect(days).toHaveLength(7);
    expect(days[0]?.getDay()).toBe(0);
    expect(days[6]?.getDay()).toBe(6);
  });

  it("covers full month grid with padding weeks", () => {
    const anchor = new Date(2026, 9, 15);
    const days = getMonthGridDays(anchor);
    expect(days.length % 7).toBe(0);
    expect(days.length).toBeGreaterThanOrEqual(35);
    expect(days.some((d) => d.getMonth() === 9)).toBe(true);
  });

  it("builds inclusive week range through end of Saturday", () => {
    const anchor = new Date(2026, 9, 8);
    const { start, end } = getVisibleRange("week", anchor);
    expect(start.getHours()).toBe(0);
    expect(end.getHours()).toBe(23);
    expect(end.getDay()).toBe(6);
  });

  it("shifts month anchor by one month", () => {
    const anchor = new Date(2026, 9, 1);
    const next = shiftAnchor("month", anchor, 1);
    expect(next.getMonth()).toBe(10);
  });
});
