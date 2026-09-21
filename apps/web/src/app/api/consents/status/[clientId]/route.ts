import { NextRequest, NextResponse } from "next/server";
import { db, clients, consents } from "@/db";
import { eq, and } from "drizzle-orm";
import { REQUIRED_CONSENT_TEMPLATES } from "@/lib/consent-templates";

interface RouteParams {
  params: Promise<{ clientId: string }>;
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  const { clientId } = await params;

  const apiKey = request.headers.get("x-api-key");
  if (!apiKey || apiKey !== process.env.DESKTOP_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const client = await db.query.clients.findFirst({
    where: eq(clients.id, clientId),
    with: {
      consents: true,
    },
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const signedConsents = client.consents.filter((c) => c.status === "signed");
  const recordingConsent = signedConsents.find(
    (c) => c.consentType === "recording_consent"
  );

  const requiredCount = REQUIRED_CONSENT_TEMPLATES.length;

  return NextResponse.json({
    clientId,
    allRequiredSigned: signedConsents.length >= requiredCount,
    recordingConsentSigned: !!recordingConsent,
    consents: client.consents.map((c) => ({
      type: c.consentType,
      status: c.status,
      signedAt: c.signedAt,
    })),
  });
}
