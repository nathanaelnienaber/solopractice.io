/**
 * Appointment types - web-safe (scheduling data only)
 */

import type { AppointmentId, ClientId, TherapistId, Timestamp } from "./common.js";

export const APPOINTMENT_STATUS = [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUS)[number];

export interface Appointment {
  id: AppointmentId;
  clientId: ClientId;
  therapistId: TherapistId;
  scheduledAt: Timestamp;
  durationMinutes: number;
  status: AppointmentStatus;
  reminderSentAt?: Timestamp;
  notes?: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface CreateAppointmentInput {
  clientId: ClientId;
  scheduledAt: Date;
  durationMinutes: number;
  notes?: string;
}

export interface AppointmentWithClient extends Appointment {
  clientFirstName: string;
  clientLastName: string;
  clientEmail: string;
  clientPhone?: string;
}
