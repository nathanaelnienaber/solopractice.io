/**
 * Common types shared between web and desktop.
 * These contain NO clinical/PHI data.
 */

export type ClientId = string & { readonly __brand: "ClientId" };
export type TherapistId = string & { readonly __brand: "TherapistId" };
export type AppointmentId = string & { readonly __brand: "AppointmentId" };
export type InvoiceId = string & { readonly __brand: "InvoiceId" };
export type ConsentId = string & { readonly __brand: "ConsentId" };

export function createClientId(id: string): ClientId {
  return id as ClientId;
}

export function createTherapistId(id: string): TherapistId {
  return id as TherapistId;
}

export function createAppointmentId(id: string): AppointmentId {
  return id as AppointmentId;
}

export function createInvoiceId(id: string): InvoiceId {
  return id as InvoiceId;
}

export function createConsentId(id: string): ConsentId {
  return id as ConsentId;
}

export interface ClientContact {
  id: ClientId;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface TherapistProfile {
  id: TherapistId;
  firstName: string;
  lastName: string;
  email: string;
  credentials: string;
  licenseState: string;
  practiceName?: string;
  stripeConnectedAccountId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export type Timestamp = Date | string;
