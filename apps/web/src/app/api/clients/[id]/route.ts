import { NextResponse } from "next/server";
import { db, clients } from "@/db";
import { and, eq } from "drizzle-orm";
import { getSessionTherapist } from "@/lib/auth";
import { REQUIRED_CONSENT_TEMPLATES } from "@/lib/consent-templates";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> }
) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await context.params;

  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, id), eq(clients.therapistId, therapist.id)),
    with: {
      consents: true,
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const requiredCount = REQUIRED_CONSENT_TEMPLATES.length;
  const signedConsents = client.consents.filter((c) => c.status === "signed");
  const recordingConsent = client.consents.find(
    (c) => c.consentType === "recording_consent" && c.status === "signed"
  );

  return NextResponse.json({
    client: {
      id: client.id,
      firstName: client.firstName,
      lastName: client.lastName,
      email: client.email,
      phone: client.phone,
      allConsentsSigned: signedConsents.length >= requiredCount,
      recordingConsentSigned: !!recordingConsent,
      consentsSigned: signedConsents.length,
      consentsRequired: requiredCount,
    },
  });
}
