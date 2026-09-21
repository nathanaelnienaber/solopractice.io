/**
 * Email Provider - Resend
 *
 * Used for:
 * - Magic link authentication
 * - Invoice notifications
 * - Consent pack invitations
 * - Appointment reminders (email channel)
 */

import { Resend } from "resend";

if (!process.env.RESEND_API_KEY) {
  console.warn("RESEND_API_KEY not set - email features will not work");
}

export const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.EMAIL_FROM ?? "noreply@solopractice.local";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  if (!process.env.RESEND_API_KEY) {
    console.log(`[EMAIL STUB] To: ${to}, Subject: ${subject}`);
    return { id: "stub-" + Date.now() };
  }

  return resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
    text,
  });
}

export async function sendMagicLink(
  email: string,
  magicLinkUrl: string,
  type: "therapist" | "client"
) {
  const subject =
    type === "therapist"
      ? "Sign in to SoloPractice"
      : "Access your appointment portal";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to SoloPractice</h2>
      <p>Click the link below to ${type === "therapist" ? "sign in to your practice dashboard" : "access your appointment portal"}:</p>
      <p style="margin: 24px 0;">
        <a href="${magicLinkUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          ${type === "therapist" ? "Sign In" : "Access Portal"}
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">This link expires in 1 hour.</p>
      <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  return sendEmail({ to: email, subject, html });
}

export async function sendConsentInvite(
  clientEmail: string,
  clientName: string,
  therapistName: string,
  consentUrl: string
) {
  const subject = `${therapistName} - Please complete your intake forms`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${clientName},</h2>
      <p>${therapistName} has invited you to complete your intake forms before your first appointment.</p>
      <p style="margin: 24px 0;">
        <a href="${consentUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Complete Intake Forms
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">This link expires in 7 days.</p>
    </div>
  `;

  return sendEmail({ to: clientEmail, subject, html });
}

export async function sendInvoiceNotification(
  clientEmail: string,
  clientName: string,
  therapistName: string,
  amountDollars: number,
  dueDate: string,
  paymentUrl: string
) {
  const subject = `Invoice from ${therapistName} - $${amountDollars.toFixed(2)}`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${clientName},</h2>
      <p>You have a new invoice from ${therapistName}.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0;"><strong>Amount:</strong> $${amountDollars.toFixed(2)}</p>
        <p style="margin: 8px 0 0;"><strong>Due:</strong> ${dueDate}</p>
      </div>
      <p style="margin: 24px 0;">
        <a href="${paymentUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Pay Now
        </a>
      </p>
    </div>
  `;

  return sendEmail({ to: clientEmail, subject, html });
}
