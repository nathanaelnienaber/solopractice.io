import { NextRequest, NextResponse } from "next/server";
import { db, clients } from "@/db";
import { eq, and } from "drizzle-orm";
import { getSessionTherapist, generateMagicLinkToken, getTokenExpiry } from "@/lib/auth";
import { sendConsentInvite } from "@/lib/email";

interface RouteParams {
  params: Promise<{ id: string }>;
}

export async function POST(request: NextRequest, { params }: RouteParams) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;

  const client = await db.query.clients.findFirst({
    where: and(
      eq(clients.id, id),
      eq(clients.therapistId, therapist.id)
    ),
  });

  if (!client) {
    return NextResponse.json({ error: "Client not found" }, { status: 404 });
  }

  const magicLinkToken = generateMagicLinkToken();
  const magicLinkExpiresAt = getTokenExpiry("client");

  await db
    .update(clients)
    .set({ magicLinkToken, magicLinkExpiresAt })
    .where(eq(clients.id, id));

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
  const consentUrl = `${baseUrl}/client/consent/${magicLinkToken}`;

  await sendConsentInvite(
    client.email,
    client.firstName,
    `${therapist.firstName} ${therapist.lastName}`,
    consentUrl
  );

  return NextResponse.json({ success: true, consentUrl });
}
