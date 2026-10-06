/**
 * Web Data Transfer Objects
 *
 * These are the ONLY shapes that may cross the web API boundary.
 * They explicitly exclude all clinical fields.
 *
 * If you need to add a field, first check: does it contain PHI?
 * - YES → Add to desktop types, NOT here
 * - NO → Safe to add here
 */

import type {
  AppointmentId,
  ClientId,
  ConsentId,
  InvoiceId,
  TherapistId,
  Timestamp,
} from "./common.js";
import type { AppointmentStatus } from "./appointment.js";
import type { ConsentStatus, ConsentType } from "./consent.js";
import type { InvoiceStatus, SuperbillRequestStatus } from "./invoice.js";

export interface WebSafeClient {
  id: ClientId;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  allRequiredConsentsSigned: boolean;
  recordingConsentSigned: boolean;
  createdAt: Timestamp;
}

export interface WebClientDTO {
  id: ClientId;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
}

export interface WebAppointmentDTO {
  id: AppointmentId;
  clientId: ClientId;
  therapistId: TherapistId;
  scheduledAt: Timestamp;
  durationMinutes: number;
  status: AppointmentStatus;
  notes?: string;
}

export interface WebInvoiceDTO {
  id: InvoiceId;
  clientId: ClientId;
  amountCents: number;
  description: string;
  status: InvoiceStatus;
  dueDate: Timestamp;
  paymentLink?: string;
  paidAt?: Timestamp;
  /** Ops-only; never includes Dx/CPT/DOB/PDF. */
  superbillRequestStatus?: SuperbillRequestStatus;
  superbillRequestedAt?: Timestamp;
  superbillSentAt?: Timestamp;
}

export interface WebConsentDTO {
  id: ConsentId;
  clientId: ClientId;
  consentType: ConsentType;
  status: ConsentStatus;
  signedAt?: Timestamp;
}

export type WebSafePayload =
  | WebClientDTO
  | WebAppointmentDTO
  | WebInvoiceDTO
  | WebConsentDTO
  | WebSafeClient;
