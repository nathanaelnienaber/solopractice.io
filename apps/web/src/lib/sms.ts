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

export interface SendSmsResult {
  sid: string;
  success: boolean;
  error?: string;
}

/**
 * Sends an SMS and always resolves to a SendSmsResult.
 *
 * Twilio throws on failure and returns a MessageInstance on success, while the
 * no-credentials stub returns a synthetic sid. Callers need one uniform shape,
 * so failures are caught and converted here rather than at every call site.
 */
export async function sendSms({
  to,
  body,
}: SendSmsOptions): Promise<SendSmsResult> {
  if (!client) {
    console.log(`[SMS STUB] To: ${to}, Body: ${body}`);
    return { sid: "stub-" + Date.now(), success: true };
  }

  try {
    const message = await client.messages.create({
      body,
      from: FROM_PHONE,
      to,
    });
    return { sid: message.sid, success: true };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown SMS error";
    console.error(`[SMS] Failed to send to ${to}: ${message}`);
    return { sid: "", success: false, error: message };
  }
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
