/**
 * Consent types — web collects signatures, desktop consumes status flags.
 */

/**
 * Individual consent record (web storage).
 * Contains signature data and audit trail — NO clinical content.
 */
export interface ConsentRecord {
  id: string;
  clientId: string;
  type: ConsentType;
  /** Version hash of the consent form template */
  templateVersion: string;
  /** ISO timestamp of signature */
  signedAt: string;
  /** Audit trail */
  ipAddress: string;
  userAgent: string;
  /** Stored signature (base64 PNG or typed name) */
  signatureData: string;
  signatureType: 'drawn' | 'typed';
}

export type ConsentType =
  | 'informed_consent'
  | 'privacy_notice'
  | 'telehealth'
  | 'recording_consent'
  | 'limits_of_confidentiality';

/**
 * Consent pack definition (which consents are required).
 */
export interface ConsentPack {
  id: string;
  name: string;
  /** State/license this pack applies to */
  state: string;
  licenseType: string;
  requiredConsents: ConsentType[];
  /** Version for tracking updates */
  version: string;
  createdAt: string;
}

/**
 * Web-safe consent status for a client (ops flags only).
 */
export interface ClientConsentStatus {
  clientId: string;
  packId: string;
  completedConsents: ConsentType[];
  pendingConsents: ConsentType[];
  allComplete: boolean;
  lastUpdated: string;
}
