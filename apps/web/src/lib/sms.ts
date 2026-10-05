/**
 * SMS Provider - Twilio
 *
 * Used for appointment reminders. Prefer `sendAndMarkAppointmentReminder` in
 * `appointment-reminders.ts` for the full send + mark path.
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

/** True when Twilio SID + auth token are present (real SMS, not stub). */
export function isTwilioConfigured(): boolean {
  return Boolean(
    process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN,
  );
}

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
 *
 * Stub mode: logs `[SMS STUB]` and returns success with a synthetic sid.
 * Auto-reminder cron skips entirely when not configured; manual Send Reminder
 * still uses this path and will mark reminderSentAt even in stub mode.
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
