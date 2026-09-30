/**
 * Web-safe types only.
 *
 * HARD RULE: This module exports ONLY types safe for the web application.
 * Clinical data (SOAP, Dx, CPT, recordings, transcripts) are NOT exported here.
 *
 * If you need clinical types, use @solopractice/shared/desktop instead.
 */

export * from "../types/common.js";
export * from "../types/consent.js";
export * from "../types/appointment.js";
export * from "../types/invoice.js";

export type {
  WebSafeClient,
  WebClientDTO,
  WebAppointmentDTO,
  WebInvoiceDTO,
  WebConsentDTO,
} from "../types/web-dto.js";

export {
  assertWebSafePayload,
  isWebSafePayload,
  findClinicalFields,
  // The error type is part of the public contract: callers catch it by identity
  // (`e instanceof WebSafetyViolationError`) to turn a blocked clinical payload
  // into a 400. It was missing from this barrel, so the web app's build failed.
  WebSafetyViolationError,
  CLINICAL_FIELD_BLOCKLIST,
} from "../guards/web-safety.js";

export type { ClinicalField } from "../guards/web-safety.js";
