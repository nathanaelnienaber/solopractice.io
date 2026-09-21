/**
 * Superbill types - DESKTOP ONLY
 *
 * ⚠️  CRITICAL SECURITY BOUNDARY ⚠️
 *
 * Superbills contain diagnosis and procedure codes - they are clinical documents.
 * Generated and stored ONLY on the desktop. Never uploaded to web.
 */

import type { ClientId, Timestamp, TherapistId } from "./common.js";
import type { DiagnosisCode, ProcedureCode, SessionId } from "./clinical.js";

export type SuperbillId = string & { readonly __brand: "SuperbillId" };

export function createSuperbillId(id: string): SuperbillId {
  return id as SuperbillId;
}

export interface Superbill {
  id: SuperbillId;
  sessionId: SessionId;
  clientId: ClientId;
  therapistId: TherapistId;
  serviceDate: Timestamp;
  diagnosisCodes: DiagnosisCode[];
  procedureCodes: ProcedureCode[];
  totalAmountCents: number;
  pdfPath?: string;
  createdAt: Timestamp;
}

export interface SuperbillGenerationInput {
  sessionId: SessionId;
  serviceDate: Date;
  diagnosisCodes: DiagnosisCode[];
  procedureCodes: ProcedureCode[];
}

export interface TherapistBillingInfo {
  practiceName: string;
  therapistName: string;
  credentials: string;
  npiNumber?: string;
  taxId?: string;
  address: {
    street: string;
    city: string;
    state: string;
    zip: string;
  };
  phone?: string;
}
