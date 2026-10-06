/**
 * Invoice types - web-safe (amounts only, NO Dx/CPT codes)
 *
 * IMPORTANT: Invoices on web contain ONLY:
 * - Amount/due date
 * - Payment status
 * - Stripe payment link
 *
 * They do NOT contain:
 * - Diagnosis codes (ICD)
 * - CPT/procedure codes
 * - Clinical descriptions
 * - SOAP references
 */

import type { AppointmentId, ClientId, InvoiceId, TherapistId, Timestamp } from "./common.js";

export const INVOICE_STATUS = [
  "draft",
  "sent",
  "viewed",
  "paid",
  "partial",
  "overdue",
  "cancelled",
  "refunded",
] as const;

export type InvoiceStatus = (typeof INVOICE_STATUS)[number];

/** Ops-only status for Ivy-like pay → request superbill. No clinical payload. */
export const SUPERBILL_REQUEST_STATUS = ["none", "requested", "sent"] as const;

export type SuperbillRequestStatus = (typeof SUPERBILL_REQUEST_STATUS)[number];

export interface Invoice {
  id: InvoiceId;
  clientId: ClientId;
  therapistId: TherapistId;
  appointmentId?: AppointmentId;
  amountCents: number;
  status: InvoiceStatus;
  description: string;
  dueDate: Timestamp;
  stripeCheckoutSessionId?: string;
  stripePaymentIntentId?: string;
  paidAt?: Timestamp;
  sentAt?: Timestamp;
  /** Client requested a superbill for this paid invoice (status only). */
  superbillRequestStatus: SuperbillRequestStatus;
  superbillRequestedAt?: Timestamp;
  superbillSentAt?: Timestamp;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateInvoiceInput {
  clientId: ClientId;
  appointmentId?: AppointmentId;
  amountCents: number;
  description: string;
  dueDate: Date;
}

/** Draft-only fields therapists may change before send. */
export interface UpdateInvoiceInput {
  amountCents?: number;
  description?: string;
  dueDate?: Date;
}

export interface InvoiceWithClient extends Invoice {
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
}

export const PLATFORM_FEE_PERCENT = 1;

export function calculatePlatformFee(amountCents: number): number {
  return Math.round(amountCents * (PLATFORM_FEE_PERCENT / 100));
}
