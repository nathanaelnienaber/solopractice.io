/**
 * Invoice status helpers for therapist UI.
 *
 * DB stores draft/sent/viewed/paid/… Overdue is also a DB enum value, but
 * nothing persists it yet — so the list/card derives Overdue from due date
 * for open (unpaid) invoices so the badge stays honest.
 */

const CLOSED_STATUSES = new Set([
  "paid",
  "cancelled",
  "refunded",
  "draft",
]);

/** Statuses that can still be paid (and may become overdue). */
const OPEN_STATUSES = new Set([
  "sent",
  "viewed",
  "partial",
  "overdue",
]);

/** First send or resend of the payment email. */
export const EMAILABLE_INVOICE_STATUSES = new Set([
  "draft",
  "sent",
  "viewed",
  "overdue",
]);

function startOfLocalDay(d: Date): Date {
  const day = new Date(d);
  day.setHours(0, 0, 0, 0);
  return day;
}

/**
 * Badge / list status. Past-due open invoices show as overdue even when the
 * row is still `sent` / `viewed` in the database.
 */
export function displayInvoiceStatus(
  status: string,
  dueDate: Date | string
): string {
  if (CLOSED_STATUSES.has(status) || !OPEN_STATUSES.has(status)) {
    return status;
  }

  const due = typeof dueDate === "string" ? new Date(dueDate) : dueDate;
  if (Number.isNaN(due.getTime())) {
    return status;
  }

  if (startOfLocalDay(due) < startOfLocalDay(new Date())) {
    return "overdue";
  }

  return status === "overdue" ? "sent" : status;
}

export function canEmailInvoiceStatus(status: string): boolean {
  return EMAILABLE_INVOICE_STATUSES.has(status);
}
