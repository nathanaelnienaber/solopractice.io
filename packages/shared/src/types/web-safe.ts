/**
 * Web-safe payload types — ONLY these may be serialized to web.
 *
 * This module defines the allowlist of types that can cross the network boundary.
 * If a type is not exported from here, it MUST NOT be sent to the web app.
 */

import type { WebSafeClient, ConsentStatusFlags } from './client';
import type { ConsentRecord, ConsentType, ConsentPack, ClientConsentStatus } from './consent';
import type { WebSafeAppointment } from './session';
import type { WebInvoice, FeeScheduleEntry } from './invoice';

// Re-export web-safe types
export type {
  WebSafeClient,
  ConsentStatusFlags,
  ConsentRecord,
  ConsentType,
  ConsentPack,
  ClientConsentStatus,
  WebSafeAppointment,
  WebInvoice,
  FeeScheduleEntry,
};

/**
 * Union of all types that are allowed in web payloads.
 */
export type WebSafePayload =
  | WebSafeClient
  | ConsentStatusFlags
  | ConsentRecord
  | ConsentType
  | ConsentPack
  | ClientConsentStatus
  | WebSafeAppointment
  | WebInvoice
  | FeeScheduleEntry;

/**
 * Web API response wrapper.
 */
export interface WebApiResponse<T extends WebSafePayload | WebSafePayload[]> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
  };
  timestamp: string;
}

/**
 * Sync payload from desktop to web (consent status only).
 */
export interface DesktopToWebSyncPayload {
  clients: Array<{
    id: string;
    consentStatus: ConsentStatusFlags;
  }>;
  syncedAt: string;
}

/**
 * Sync payload from web to desktop (consent completions).
 */
export interface WebToDesktopSyncPayload {
  clientConsentUpdates: Array<{
    clientId: string;
    consentStatus: ConsentStatusFlags;
  }>;
  appointments: WebSafeAppointment[];
  invoices: WebInvoice[];
  syncedAt: string;
}

/**
 * Fields that are ALLOWED in web payloads (allowlist).
 */
export const WEB_SAFE_FIELDS = [
  // Client ops fields
  'id',
  'firstName',
  'lastName',
  'email',
  'phone',
  'consentStatus',
  'createdAt',
  'updatedAt',

  // Consent fields
  'type',
  'templateVersion',
  'signedAt',
  'ipAddress',
  'userAgent',
  'signatureData',
  'signatureType',
  'completedConsents',
  'pendingConsents',
  'allComplete',

  // Appointment fields
  'clientId',
  'scheduledAt',
  'durationMinutes',
  'sessionType',
  'status',
  'reminderSentAt',

  // Invoice fields
  'sessionRef',
  'amountCents',
  'currency',
  'description',
  'dueDate',
  'stripePaymentId',
  'checkoutUrl',
  'paidAt',
  'platformFeeCents',
  'stripeFeeCents',

  // Consent status flags
  'informedConsent',
  'privacyNotice',
  'telehealth',
  'recordingConsent',
  'limitsOfConfidentiality',
  'lastUpdated',

  // Meta
  'success',
  'data',
  'error',
  'code',
  'message',
  'timestamp',
  'syncedAt',
  'clients',
  'clientConsentUpdates',
  'appointments',
  'invoices',
  'packId',
  'name',
  'state',
  'licenseType',
  'requiredConsents',
  'version',
  'feeCents',
] as const;

export type WebSafeFieldName = (typeof WEB_SAFE_FIELDS)[number];
