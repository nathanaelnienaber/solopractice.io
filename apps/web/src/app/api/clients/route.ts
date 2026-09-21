import { NextRequest, NextResponse } from "next/server";
import { db, clients, consents } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionTherapist, generateId, generateMagicLinkToken, getTokenExpiry } from "@/lib/auth";
import { validateWebSafeRequest, webSafetyErrorResponse } from "@/lib/web-safety";
import { REQUIRED_CONSENT_TEMPLATES } from "@/lib/consent-templates";

export async function GET() {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const clientList = await db.query.clients.findMany({
    where: eq(clients.therapistId, therapist.id),
    with: {
      consents: true,
    },
    orderBy: (clients, { desc }) => [desc(clients.createdAt)],
  });

  const requiredCount = REQUIRED_CONSENT_TEMPLATES.length;

  return NextResponse.json({
    clients: clientList.map((client) => {
      const signedConsents = client.consents.filter((c) => c.status === "signed");
      const recordingConsent = client.consents.find(
        (c) => c.consentType === "recording_consent" && c.status === "signed"
      );

      return {
        id: client.id,
        firstName: client.firstName,
        lastName: client.lastName,
        email: client.email,
        phone: client.phone,
        allConsentsSigned: signedConsents.length >= requiredCount,
        recordingConsentSigned: !!recordingConsent,
        consentsSigned: signedConsents.length,
        consentsRequired: requiredCount,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validation = await validateWebSafeRequest(request);
  if (!validation.valid) {
    return webSafetyErrorResponse(validation.error);
  }

  const { firstName, lastName, email, phone } = validation.body as {
    firstName: string;
    lastName: string;
    email: string;
    phone?: string;
  };

  if (!firstName || !lastName || !email) {
    return NextResponse.json(
      { error: "First name, last name, and email are required" },
      { status: 400 }
    );
  }

  const clientId = generateId();
  const magicLinkToken = generateMagicLinkToken();
  const magicLinkExpiresAt = getTokenExpiry("client");

  await db.insert(clients).values({
    id: clientId,
    therapistId: therapist.id,
    firstName,
    lastName,
    email: email.toLowerCase(),
    phone,
    magicLinkToken,
    magicLinkExpiresAt,
  });

  return NextResponse.json({
    client: {
      id: clientId,
      firstName,
      lastName,
      email,
      phone,
    },
    consentLink: `/client/consent/${magicLinkToken}`,
  });
}
