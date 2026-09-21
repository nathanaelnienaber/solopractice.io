/**
 * Email Provider - Resend
 *
 * Handles magic links, consent invites, reminders, and receipts.
 * NO clinical content in emails.
 */

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@solopractice.io';
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';

export interface EmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

/**
 * Send a magic link for client portal access.
 */
export async function sendMagicLink(
  to: string,
  clientName: string,
  token: string
): Promise<EmailResult> {
  try {
    const link = `${APP_URL}/portal/login?token=${token}`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: 'Access your client portal',
      html: `
        <h2>Hello ${clientName},</h2>
        <p>Click the link below to access your secure client portal:</p>
        <p><a href="${link}" style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Access Portal</a></p>
        <p>This link expires in 24 hours.</p>
        <p>If you didn't request this link, you can safely ignore this email.</p>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Send consent pack invite.
 */
export async function sendConsentInvite(
  to: string,
  clientName: string,
  therapistName: string,
  token: string
): Promise<EmailResult> {
  try {
    const link = `${APP_URL}/consents/${token}`;

    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Complete your intake forms for ${therapistName}`,
      html: `
        <h2>Hello ${clientName},</h2>
        <p>${therapistName} has invited you to complete your intake consent forms.</p>
        <p>Please complete these forms before your first session:</p>
        <p><a href="${link}" style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Complete Consent Forms</a></p>
        <p>This link is valid for 7 days.</p>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Send invoice/payment request.
 */
export async function sendInvoice(
  to: string,
  clientName: string,
  amountFormatted: string,
  dueDate: string,
  paymentLink: string,
  description: string
): Promise<EmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Invoice: ${description}`,
      html: `
        <h2>Hello ${clientName},</h2>
        <p>You have a new invoice:</p>
        <table style="margin: 20px 0;">
          <tr><td style="padding: 8px 0;"><strong>Amount:</strong></td><td>${amountFormatted}</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Due Date:</strong></td><td>${dueDate}</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Description:</strong></td><td>${description}</td></tr>
        </table>
        <p><a href="${paymentLink}" style="background-color: #0284c7; color: white; padding: 12px 24px; text-decoration: none; border-radius: 8px; display: inline-block;">Pay Now</a></p>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Send payment receipt.
 */
export async function sendReceipt(
  to: string,
  clientName: string,
  amountFormatted: string,
  paidDate: string,
  description: string
): Promise<EmailResult> {
  try {
    const { data, error } = await resend.emails.send({
      from: FROM_EMAIL,
      to,
      subject: `Payment Receipt: ${description}`,
      html: `
        <h2>Hello ${clientName},</h2>
        <p>Thank you for your payment!</p>
        <table style="margin: 20px 0;">
          <tr><td style="padding: 8px 0;"><strong>Amount Paid:</strong></td><td>${amountFormatted}</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Date:</strong></td><td>${paidDate}</td></tr>
          <tr><td style="padding: 8px 0;"><strong>Description:</strong></td><td>${description}</td></tr>
        </table>
        <p>This email serves as your receipt.</p>
      `,
    });

    if (error) {
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export { resend };
