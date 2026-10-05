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

  // Omit undefined optional fields — some Resend SDK versions serialize
  // `text: undefined` into the JSON body.
  const payload: {
    from: string;
    to: string;
    subject: string;
    html: string;
    text?: string;
  } = {
    from: FROM_EMAIL,
    to,
    subject,
    html,
  };
  if (text) {
    payload.text = text;
  }

  const { data, error } = await resend.emails.send(payload);

  if (error) {
    // Resend's SDK resolves (never rejects) on a failed send, returning
    // { data: null, error }. Returning that silently here meant callers
    // (e.g. the magic-link route) saw success and told the user to check
    // their inbox for an email that was never sent. Surface it as a real
    // thrown error so callers' existing try/catch -> 500 paths fire.
    throw new Error(`Resend send failed (${error.name}): ${error.message}`);
  }

  if (!data?.id) {
    throw new Error("Resend accepted the request but returned no message id");
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

  const actionLabel = type === "therapist" ? "Sign In" : "Open Link";
  const intro =
    type === "therapist"
      ? "sign in to your practice dashboard"
      : "open the secure link from your therapist";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Welcome to SoloPractice</h2>
      <p>Click the link below to ${intro}:</p>
      <p style="margin: 24px 0;">
        <a href="${magicLinkUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          ${actionLabel}
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">${expiryCopy}</p>
      <p style="color: #666; font-size: 14px;">If you didn't request this, you can safely ignore this email.</p>
    </div>
  `;

  const text = [
    "Welcome to SoloPractice",
    "",
    `Open this link to ${intro}:`,
    magicLinkUrl,
    "",
    expiryCopy,
    "If you didn't request this, you can safely ignore this email.",
  ].join("\n");

  return sendEmail({ to: email, subject, html, text });
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

  const text = [
    `Hello ${clientName},`,
    "",
    `${therapistName} has invited you to complete your intake forms before your first appointment.`,
    "",
    `Complete intake forms: ${consentUrl}`,
    "",
    "This link expires in 7 days.",
  ].join("\n");

  return sendEmail({ to: clientEmail, subject, html, text });
}

export async function sendInvoiceNotification(
  clientEmail: string,
  clientName: string,
  therapistName: string,
  amountDollars: number,
  dueDate: string,
  paymentUrl: string
) {
  // Match consent/auth tone: no "$…" in the subject and no "Pay Now" CTA —
  // those patterns are common spam/phishing filters, while consent invites
  // to the same address deliver fine through the same Resend from/to path.
  const amountLabel = amountDollars.toFixed(2);
  const subject = `${therapistName} - Your invoice is ready`;

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>Hello ${clientName},</h2>
      <p>${therapistName} sent you an invoice for your recent session.</p>
      <div style="background: #f3f4f6; padding: 16px; border-radius: 8px; margin: 16px 0;">
        <p style="margin: 0;"><strong>Amount due:</strong> ${amountLabel} USD</p>
        <p style="margin: 8px 0 0;"><strong>Due date:</strong> ${dueDate}</p>
      </div>
      <p style="margin: 24px 0;">
        <a href="${paymentUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          View invoice
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">If the button does not work, open this link: ${paymentUrl}</p>
    </div>
  `;

  const text = [
    `Hello ${clientName},`,
    "",
    `${therapistName} sent you an invoice for your recent session.`,
    "",
    `Amount due: ${amountLabel} USD`,
    `Due date: ${dueDate}`,
    "",
    `View invoice: ${paymentUrl}`,
  ].join("\n");

  return sendEmail({ to: clientEmail, subject, html, text });
}
