/**
 * SMS Provider - Twilio
 *
 * Used for appointment reminders.
 */

import twilio from "twilio";

if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
  console.warn("Twilio credentials not set - SMS features will not work");
}

const client =
  process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN
    ? twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
    : null;

const FROM_PHONE = process.env.TWILIO_PHONE_NUMBER ?? "+15555555555";

export interface SendSmsOptions {
  to: string;
  body: string;
}

export async function sendSms({ to, body }: SendSmsOptions) {
  if (!client) {
    console.log(`[SMS STUB] To: ${to}, Body: ${body}`);
    return { sid: "stub-" + Date.now() };
  }

  return client.messages.create({
    body,
    from: FROM_PHONE,
    to,
  });
}

export async function sendAppointmentReminder(
  phone: string,
  clientName: string,
  therapistName: string,
  appointmentDate: string,
  appointmentTime: string
) {
  const body = `Hi ${clientName}, reminder: You have an appointment with ${therapistName} on ${appointmentDate} at ${appointmentTime}. Reply STOP to unsubscribe.`;

  return sendSms({ to: phone, body });
}
