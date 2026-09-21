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
  CLINICAL_FIELD_BLOCKLIST,
} from "../guards/web-safety.js";
