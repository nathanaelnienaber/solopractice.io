/**
 * Database Schema - Web Application
 *
 * ⚠️  SECURITY: This schema contains ONLY ops data.
 *
 * The following are explicitly EXCLUDED and must NEVER be added:
 * - SOAP notes
 * - Diagnosis codes (ICD)
 * - Procedure codes (CPT)
 * - Audio recordings
 * - Transcripts
 * - Any clinical narrative
 *
 * See packages/shared for the full type definitions.
 */

import {
  pgTable,
  text,
  timestamp,
  integer,
  boolean,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

export const consentStatusEnum = pgEnum("consent_status", [
  "pending",
  "signed",
  "declined",
  "expired",
]);

export const consentTypeEnum = pgEnum("consent_type", [
  "informed_consent",
  "privacy_practices",
  "telehealth_consent",
  "recording_consent",
  "limits_of_confidentiality",
]);

export const appointmentStatusEnum = pgEnum("appointment_status", [
  "scheduled",
  "confirmed",
  "completed",
  "cancelled",
  "no_show",
]);

export const invoiceStatusEnum = pgEnum("invoice_status", [
  "draft",
  "sent",
  "viewed",
  "paid",
  "partial",
  "overdue",
  "cancelled",
  "refunded",
]);

export const therapists = pgTable("therapists", {
  id: text("id").primaryKey(),
  email: text("email").notNull().unique(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  credentials: text("credentials").notNull(),
  licenseState: text("license_state").notNull(),
  practiceName: text("practice_name"),
  stripeConnectedAccountId: text("stripe_connected_account_id"),
  stripeOnboardingComplete: boolean("stripe_onboarding_complete")
    .notNull()
    .default(false),
  // Per-therapist shared secret the desktop app presents when polling consent
  // status. Stored hashed would be ideal, but the desktop needs to send the raw
  // value, so this holds it directly. Treat as a secret: never return it from a
  // GET route, only rotate it through the POST route.
  desktopApiKey: text("desktop_api_key"),
  desktopApiKeyCreatedAt: timestamp("desktop_api_key_created_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const clients = pgTable("clients", {
  id: text("id").primaryKey(),
  therapistId: text("therapist_id")
    .notNull()
    .references(() => therapists.id),
  email: text("email").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  phone: text("phone"),
  magicLinkToken: text("magic_link_token"),
  magicLinkExpiresAt: timestamp("magic_link_expires_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const consents = pgTable("consents", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  consentType: consentTypeEnum("consent_type").notNull(),
  status: consentStatusEnum("status").notNull().default("pending"),
  formVersionHash: text("form_version_hash").notNull(),
  signedAt: timestamp("signed_at"),
  signatureData: text("signature_data"),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const appointments = pgTable("appointments", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  therapistId: text("therapist_id")
    .notNull()
    .references(() => therapists.id),
  scheduledAt: timestamp("scheduled_at").notNull(),
  durationMinutes: integer("duration_minutes").notNull().default(50),
  status: appointmentStatusEnum("status").notNull().default("scheduled"),
  notes: text("notes"),
  reminderSentAt: timestamp("reminder_sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const invoices = pgTable("invoices", {
  id: text("id").primaryKey(),
  clientId: text("client_id")
    .notNull()
    .references(() => clients.id),
  therapistId: text("therapist_id")
    .notNull()
    .references(() => therapists.id),
  appointmentId: text("appointment_id").references(() => appointments.id),
  amountCents: integer("amount_cents").notNull(),
  description: text("description").notNull(),
  status: invoiceStatusEnum("status").notNull().default("draft"),
  dueDate: timestamp("due_date").notNull(),
  stripeCheckoutSessionId: text("stripe_checkout_session_id"),
  stripePaymentIntentId: text("stripe_payment_intent_id"),
  paidAt: timestamp("paid_at"),
  sentAt: timestamp("sent_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const consentFormTemplates = pgTable("consent_form_templates", {
  id: text("id").primaryKey(),
  therapistId: text("therapist_id")
    .notNull()
    .references(() => therapists.id),
  consentType: consentTypeEnum("consent_type").notNull(),
  title: text("title").notNull(),
  version: text("version").notNull(),
  versionHash: text("version_hash").notNull(),
  content: text("content").notNull(),
  isRequired: boolean("is_required").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const therapistsRelations = relations(therapists, ({ many }) => ({
  clients: many(clients),
  appointments: many(appointments),
  invoices: many(invoices),
  consentFormTemplates: many(consentFormTemplates),
}));

export const clientsRelations = relations(clients, ({ one, many }) => ({
  therapist: one(therapists, {
    fields: [clients.therapistId],
    references: [therapists.id],
  }),
  consents: many(consents),
  appointments: many(appointments),
  invoices: many(invoices),
}));

export const consentsRelations = relations(consents, ({ one }) => ({
  client: one(clients, {
    fields: [consents.clientId],
    references: [clients.id],
  }),
}));

export const appointmentsRelations = relations(appointments, ({ one }) => ({
  client: one(clients, {
    fields: [appointments.clientId],
    references: [clients.id],
  }),
  therapist: one(therapists, {
    fields: [appointments.therapistId],
    references: [therapists.id],
  }),
}));

export const invoicesRelations = relations(invoices, ({ one }) => ({
  client: one(clients, {
    fields: [invoices.clientId],
    references: [clients.id],
  }),
  therapist: one(therapists, {
    fields: [invoices.therapistId],
    references: [therapists.id],
  }),
  appointment: one(appointments, {
    fields: [invoices.appointmentId],
    references: [appointments.id],
  }),
}));

export const consentFormTemplatesRelations = relations(
  consentFormTemplates,
  ({ one }) => ({
    therapist: one(therapists, {
      fields: [consentFormTemplates.therapistId],
      references: [therapists.id],
    }),
  })
);
