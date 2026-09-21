/**
 * @solopractice/shared
 *
 * SECURITY ARCHITECTURE:
 * This package enforces the hard boundary between clinical (PHI) and ops data.
 *
 * - Desktop-only types: SOAP, Dx, CPT, recordings, transcripts
 * - Web-safe types: client contact, consent flags, appointments, invoices
 *
 * RULE: Clinical fields NEVER appear in web DTOs.
 */

export * from "./types/common.js";
export * from "./types/consent.js";
export * from "./types/appointment.js";
export * from "./types/invoice.js";
