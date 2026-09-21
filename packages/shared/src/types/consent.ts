/**
 * Consent types - web-safe (flags only, not clinical content)
 */

import type { ClientId, ConsentId, Timestamp } from "./common.js";

export const CONSENT_TYPES = [
  "informed_consent",
  "privacy_practices",
  "telehealth_consent",
  "recording_consent",
  "limits_of_confidentiality",
] as const;

export type ConsentType = (typeof CONSENT_TYPES)[number];

export const CONSENT_STATUS = ["pending", "signed", "declined", "expired"] as const;
export type ConsentStatus = (typeof CONSENT_STATUS)[number];

export interface ConsentRecord {
  id: ConsentId;
  clientId: ClientId;
  consentType: ConsentType;
  status: ConsentStatus;
  formVersionHash: string;
  signedAt?: Timestamp;
  signatureData?: string;
  ipAddress?: string;
  userAgent?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface ConsentPackStatus {
  clientId: ClientId;
  allRequiredSigned: boolean;
  recordingConsentSigned: boolean;
  consents: {
    type: ConsentType;
    status: ConsentStatus;
    signedAt?: Timestamp;
  }[];
}

export interface ConsentFormTemplate {
  type: ConsentType;
  title: string;
  version: string;
  versionHash: string;
  content: string;
  isRequired: boolean;
}

export const REQUIRED_CONSENTS_FOR_RECORDING: ConsentType[] = [
  "informed_consent",
  "privacy_practices",
  "recording_consent",
];
