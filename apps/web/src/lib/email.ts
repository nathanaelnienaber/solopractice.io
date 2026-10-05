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

export const resend = new Resend(process.env.RESEND_API_KEY ?? "re_placeholder");

const FROM_EMAIL = process.env.EMAIL_FROM ?? "noreply@solopractice.local";

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail({ to, subject, html, text }: SendEmailOptions) {
  // Never pretend a send succeeded when Resend is not configured. The old
  // stub logged and returned a fake id, which let invoice "Send" mark the
  // row as sent with no message leaving the server.
  if (!process.env.RESEND_API_KEY) {
    console.error(`[EMAIL] RESEND_API_KEY missing; refusing to send to ${to}`);
    throw new Error("Email is not configured (RESEND_API_KEY missing)");
  }

  const { data, error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject,
    html,
    text,
  });

  if (error) {
    // Resend's SDK resolves (never rejects) on a failed send, returning
    // { data: null, error }. Returning that silently here meant callers
    // (e.g. the magic-link route) saw success and told the user to check
    // their inbox for an email that was never sent. Surface it as a real
    // thrown error so callers' existing try/catch -> 500 paths fire.
    throw new Error(`Resend send failed (${error.name}): ${error.message}`);
  }

  return data;
}

export async function sendMagicLink(
  email: string,
  magicLinkUrl: string,
  type: "therapist" | "client"
) {
  const subject =
    type === "therapist"
      ? "Sign in to SoloPractice"
      : "Your SoloPractice link";

  const expiryCopy =
    type === "therapist"
      ? "This link expires in 15 minutes."
      : "This link expires in 7 days.";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to SoloPractice</h2>
      <p>Click the link below to ${type === "therapist" ? "sign in to your practice dashboard" : "open the secure link from your therapist"}:</p>
      <p style="margin: 24px 0;">
        <a href="${magicLinkUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          ${type === "therapist" ? "Sign In" : "Open Link"}
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">${expiryCopy}</p>
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
