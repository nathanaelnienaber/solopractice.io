import {
  addDays,
  addMonths,
  addWeeks,
  endOfDay,
  endOfMonth,
  endOfWeek,
  format,
  isSameDay,
  isSameMonth,
  startOfDay,
  startOfMonth,
  startOfWeek,
  subMonths,
  subWeeks,
} from "date-fns";

export type CalendarView = "week" | "month";

export { isSameDay, format };

/** Week grid starts on Sunday to match the existing appointments UI. */
export function getWeekDays(anchor: Date): Date[] {
  const start = startOfWeek(anchor, { weekStartsOn: 0 });
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}

/** Full month grid including leading/trailing days for a 6-row calendar. */
export function getMonthGridDays(anchor: Date): Date[] {
  const monthStart = startOfMonth(anchor);
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const monthEnd = endOfMonth(anchor);
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  const days: Date[] = [];
  let cursor = gridStart;
  while (cursor <= gridEnd) {
    days.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return days;
}

export function getVisibleRange(
  view: CalendarView,
  anchor: Date
): { start: Date; end: Date; label: string } {
  if (view === "week") {
    const days = getWeekDays(anchor);
    const start = startOfDay(days[0]!);
    const end = endOfDay(days[6]!);
    const label = `${format(start, "MMM d")} – ${format(end, "MMM d, yyyy")}`;
    return { start, end, label };
  }

  const start = startOfDay(startOfMonth(anchor));
  const end = endOfDay(endOfMonth(anchor));
  const label = format(anchor, "MMMM yyyy");
  return { start, end, label };
}

export function shiftAnchor(
  view: CalendarView,
  anchor: Date,
  direction: -1 | 1
): Date {
  if (view === "week") {
    return direction === 1 ? addWeeks(anchor, 1) : subWeeks(anchor, 1);
  }
  return direction === 1 ? addMonths(anchor, 1) : subMonths(anchor, 1);
}

export function isInVisibleMonth(day: Date, anchor: Date): boolean {
  return isSameMonth(day, anchor);
}

/** Hour rows for week view (8 AM – 7 PM). */
export const CALENDAR_HOURS = Array.from({ length: 12 }, (_, i) => i + 8);
