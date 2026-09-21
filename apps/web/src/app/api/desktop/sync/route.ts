import { NextRequest, NextResponse } from "next/server";
import { db, clients, consents, therapists } from "@/db";
import { eq, and } from "drizzle-orm";
import { REQUIRED_CONSENT_TEMPLATES } from "@/lib/consent-templates";

/**
 * Desktop Sync API
 * 
 * This endpoint allows the desktop app to sync client data.
 * Authentication is via API key header (X-Desktop-API-Key).
 * 
 * SECURITY: Only returns non-PHI data needed for consent status.
 * Clinical data (SOAP, Dx, CPT, recordings) stays on desktop only.
 */

async function authenticateDesktopRequest(request: NextRequest) {
  const apiKey = request.headers.get("X-Desktop-API-Key");
  
  if (!apiKey) {
    return null;
  }

  // Find therapist by desktop API key
  const therapist = await db.query.therapists.findFirst({
    where: eq(therapists.desktopApiKey, apiKey),
  });

  return therapist;
}

export async function GET(request: NextRequest) {
  const therapist = await authenticateDesktopRequest(request);
  
  if (!therapist) {
    return NextResponse.json(
      { error: "Invalid or missing API key. Generate one in Settings > Desktop Sync." },
      { status: 401 }
    );
  }

  // Get all clients with their consent status
  const clientList = await db.query.clients.findMany({
    where: eq(clients.therapistId, therapist.id),
    with: {
      consents: true,
    },
  });

  const requiredCount = REQUIRED_CONSENT_TEMPLATES.length;

  // Return only non-PHI data needed for desktop sync
  const syncData = {
    therapist: {
      id: therapist.id,
      firstName: therapist.firstName,
      lastName: therapist.lastName,
      email: therapist.email,
      practiceName: therapist.practiceName,
      credentials: therapist.credentials,
    },
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
        // Consent status flags - this is what desktop needs
        allConsentsSigned: signedConsents.length >= requiredCount,
        recordingConsentSigned: !!recordingConsent,
        consentsSigned: signedConsents.length,
        consentsRequired: requiredCount,
        // Individual consent statuses
        consents: client.consents.map((c) => ({
          type: c.consentType,
          status: c.status,
          signedAt: c.signedAt,
        })),
      };
    }),
    syncedAt: new Date().toISOString(),
  };

  return NextResponse.json(syncData);
}

// POST to trigger a single client sync (for real-time updates)
export async function POST(request: NextRequest) {
  const therapist = await authenticateDesktopRequest(request);
  
  if (!therapist) {
    return NextResponse.json(
      { error: "Invalid or missing API key" },
      { status: 401 }
    );
  }

  const { clientId } = await request.json();

  if (!clientId) {
    return NextResponse.json(
      { error: "clientId is required" },
      { status: 400 }
    );
  }

  const client = await db.query.clients.findFirst({
    where: and(
      eq(clients.id, clientId),
      eq(clients.therapistId, therapist.id)
    ),
    with: {
      consents: true,
    },
  });

  if (!client) {
    return NextResponse.json(
      { error: "Client not found" },
      { status: 404 }
    );
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
