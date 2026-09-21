/**
 * Invoice types — web billing only (no clinical codes).
 */

/**
 * Web invoice — amount, due date, payment link.
 * NO Dx/CPT codes — those are on the superbill (desktop only).
 */
export interface WebInvoice {
  id: string;
  clientId: string;
  /** Reference to session for linking (opaque, not clinical) */
  sessionRef?: string;
  /** Amount in cents */
  amountCents: number;
  /** Currency code */
  currency: 'usd';
  /** Invoice description (NO clinical content) */
  description: string;
  /** Due date ISO */
  dueDate: string;
  /** Payment status */
  status: 'draft' | 'sent' | 'paid' | 'cancelled' | 'overdue';
  /** Stripe payment intent or checkout session ID */
  stripePaymentId?: string;
  /** Stripe checkout URL for client */
  checkoutUrl?: string;
  /** When paid */
  paidAt?: string;
  /** Platform fee (1% of amount) in cents */
  platformFeeCents: number;
  /** Stripe processing fee in cents (estimated) */
  stripeFeeCents: number;
  createdAt: string;
  updatedAt: string;
}

/**
 * Fee schedule entry (therapist configures).
 */
export interface FeeScheduleEntry {
  id: string;
  sessionType: 'individual' | 'telehealth' | 'group';
  durationMinutes: number;
  /** Fee in cents */
  feeCents: number;
  description: string;
}

/**
 * Superbill (desktop only — contains clinical codes).
 * Generated locally, never uploaded to web.
 */
export interface DesktopSuperbill {
  localId: number;
  sessionLocalId: number;
  clientLocalId: number;
  /** Service date */
  serviceDate: string;
  /** Provider info */
  providerName: string;
  providerNPI?: string;
  providerLicense: string;
  /** Client info for superbill */
  clientName: string;
  clientDOB?: string;
  /** CPT codes with fees — NEVER sync to web */
  lineItems: SuperbillLineItem[];
  /** Diagnosis codes — NEVER sync to web */
  diagnosisCodes: string[];
  /** Total in cents */
  totalCents: number;
  /** Generated PDF path (local) */
  pdfPath?: string;
  createdAt: string;
}

export interface SuperbillLineItem {
  cptCode: string;
  description: string;
  units: number;
  /** Fee in cents */
  feeCents: number;
}

/**
 * Type guard for superbill (clinical document).
 */
export function isSuperbill(doc: unknown): doc is DesktopSuperbill {
  if (!doc || typeof doc !== 'object') return false;
  const d = doc as Record<string, unknown>;
  return 'cptCode' in d || 'diagnosisCodes' in d || 'lineItems' in d;
}
