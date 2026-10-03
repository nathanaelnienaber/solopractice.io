import { NextRequest, NextResponse } from "next/server";
import { db, clients } from "@/db";
import { eq, and } from "drizzle-orm";
import { REQUIRED_CONSENT_TEMPLATES } from "@/lib/consent-templates";
import { authenticateDesktopRequest } from "@/lib/desktop-auth";

interface RouteParams {
  params: Promise<{ clientId: string }>;
}

/**
 * GET /api/consents/status/[clientId]
 *
 * Consent status for a single client, polled by the desktop app before it will
 * start a recording.
 *
 * SECURITY: authenticated with the caller's own per-therapist desktop API key
 * (X-Desktop-API-Key), exactly as /api/desktop/sync is, and the lookup is
 * scoped by `therapist_id` as well as `id`.
 *
 * This previously accepted a single environment-wide DESKTOP_API_KEY and then
 * fetched the client by id alone: any holder of that one shared secret could
 * read ANY therapist's client consent record, across tenants. A key that only
 * answers "is this a valid caller" cannot answer "may this caller see this
 * row" — the therapist scope has to be in the query.
 *
 * A client belonging to another therapist returns 404, not 403: a therapist
 * must not be able to probe for the existence of another therapist's client
 * ids.
 */
export async function GET(request: NextRequest, { params }: RouteParams) {
  const { clientId } = await params;

  const therapist = await authenticateDesktopRequest(request);

  if (!therapist) {
    return NextResponse.json(
      {
        error:
          "Invalid or missing API key. Generate one in Settings > Desktop Sync.",
      },
      { status: 401 },
    );
  }

  const client = await db.query.clients.findFirst({
    where: and(eq(clients.id, clientId), eq(clients.therapistId, therapist.id)),
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
