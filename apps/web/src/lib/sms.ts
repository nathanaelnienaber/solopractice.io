/**
 * SMS Provider - Twilio
 *
 * Handles session reminders and notifications.
 * NO clinical content in SMS.
 */

import twilio from 'twilio';

const accountSid = process.env.TWILIO_ACCOUNT_SID;
const authToken = process.env.TWILIO_AUTH_TOKEN;
const fromNumber = process.env.TWILIO_PHONE_NUMBER;

// Initialize Twilio client only if credentials are available
const client = accountSid && authToken ? twilio(accountSid, authToken) : null;

export interface SMSResult {
  success: boolean;
  sid?: string;
  error?: string;
}

/**
 * Send an appointment reminder.
 */
export async function sendAppointmentReminder(
  to: string,
  therapistName: string,
  appointmentDate: string,
  appointmentTime: string
): Promise<SMSResult> {
  if (!client || !fromNumber) {
    console.warn('Twilio not configured, skipping SMS');
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const message = await client.messages.create({
      body: `Reminder: You have an appointment with ${therapistName} on ${appointmentDate} at ${appointmentTime}. Reply STOP to unsubscribe.`,
      from: fromNumber,
      to,
    });

    return { success: true, sid: message.sid };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Send a payment confirmation.
 */
export async function sendPaymentConfirmation(
  to: string,
  amountFormatted: string
): Promise<SMSResult> {
  if (!client || !fromNumber) {
    console.warn('Twilio not configured, skipping SMS');
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const message = await client.messages.create({
      body: `Thank you! Your payment of ${amountFormatted} has been received. Reply STOP to unsubscribe.`,
      from: fromNumber,
      to,
    });

    return { success: true, sid: message.sid };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

/**
 * Send consent reminder.
 */
export async function sendConsentReminder(
  to: string,
  therapistName: string,
  link: string
): Promise<SMSResult> {
  if (!client || !fromNumber) {
    console.warn('Twilio not configured, skipping SMS');
    return { success: false, error: 'Twilio not configured' };
  }

  try {
    const message = await client.messages.create({
      body: `${therapistName} is waiting for you to complete your intake forms. Complete them here: ${link} Reply STOP to unsubscribe.`,
      from: fromNumber,
      to,
    });

    return { success: true, sid: message.sid };
  } catch (err) {
    return { success: false, error: String(err) };
  }
}

export { client };
