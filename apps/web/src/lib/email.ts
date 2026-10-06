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

/** Strip an optional display-name wrapper so we can re-attach a trusted From name. */
function fromAddressOnly(from: string): string {
  const angled = from.match(/<([^>]+)>/);
  return (angled?.[1] ?? from).trim();
}

/** Build `Display Name <addr@domain>` without breaking EMAIL_FROM that already has a name. */
export function formatFromHeader(displayName: string, from = FROM_EMAIL): string {
  const address = fromAddressOnly(from);
  const safeName = displayName.replace(/[\r\n"<>]/g, "").trim();
  if (!safeName) return address;
  return `${safeName} <${address}>`;
}

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
  /** Overrides the bare EMAIL_FROM address with a display name (same mailbox). */
  fromDisplayName?: string;
  /** Client Reply goes to the therapist, not the noreply mailbox. */
  replyTo?: string;
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  fromDisplayName,
  replyTo,
}: SendEmailOptions) {
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
    replyTo?: string;
  } = {
    from: fromDisplayName ? formatFromHeader(fromDisplayName) : FROM_EMAIL,
    to,
    subject,
    html,
  };
  if (text) {
    payload.text = text;
  }
  if (replyTo) {
    payload.replyTo = replyTo;
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

  const actionLabel = type === "therapist" ? "Sign in" : "Open link";
  const heading =
    type === "therapist" ? "Sign in to SoloPractice" : "Your SoloPractice link";
  const intro =
    type === "therapist"
      ? "sign in to your practice"
      : "open the link from your therapist";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
      <h2>${heading}</h2>
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
    heading,
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
      <h2>Hi ${clientName},</h2>
      <p>${therapistName} asked you to complete a few intake forms before your first appointment.</p>
      <p style="margin: 24px 0;">
        <a href="${consentUrl}" style="background: #2563eb; color: white; padding: 12px 24px; border-radius: 6px; text-decoration: none;">
          Complete intake forms
        </a>
      </p>
      <p style="color: #666; font-size: 14px;">This link expires in 7 days.</p>
    </div>
  `;

  const text = [
    `Hi ${clientName},`,
    "",
    `${therapistName} asked you to complete a few intake forms before your first appointment.`,
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
  paymentUrl: string,
  options?: { replyTo?: string }
) {
  // Soft copy (no "$" in subject, no "Pay Now") plus trust signals:
  // therapist display-name From, Reply-To therapist, plain text link CTA
  // (not a solid payment button), and a short transactional footer.
  const amountLabel = amountDollars.toFixed(2);
  const subject = `${therapistName} - Your invoice is ready`;
  const footer =
    "This message was sent by SoloPractice on behalf of your therapist. Reply to this email to reach them directly.";

  const html = `
    <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #111;">
      <p>Hi ${clientName},</p>
      <p>${therapistName} sent you an invoice for your recent session.</p>
      <p>Amount due: ${amountLabel} USD<br>Due date: ${dueDate}</p>
      <p><a href="${paymentUrl}" style="color: #1d4ed8;">View your invoice</a></p>
      <p style="color: #666; font-size: 14px;">Or open this link:<br>${paymentUrl}</p>
      <p style="color: #666; font-size: 13px; margin-top: 32px;">${footer}</p>
    </div>
  `;

  const text = [
    `Hi ${clientName},`,
    "",
    `${therapistName} sent you an invoice for your recent session.`,
    "",
    `Amount due: ${amountLabel} USD`,
    `Due date: ${dueDate}`,
    "",
    `View your invoice: ${paymentUrl}`,
    "",
    footer,
  ].join("\n");

  return sendEmail({
    to: clientEmail,
    subject,
    html,
    text,
    fromDisplayName: therapistName,
    replyTo: options?.replyTo,
  });
}
