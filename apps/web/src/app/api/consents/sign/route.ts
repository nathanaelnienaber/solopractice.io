import { NextRequest, NextResponse } from "next/server";
import { db, clients, consents } from "@/db";
import { eq, and } from "drizzle-orm";
import { generateId } from "@/lib/auth";
import { validateWebSafeRequest, webSafetyErrorResponse } from "@/lib/web-safety";
import type { ConsentType } from "@solopractice/shared";

export async function POST(request: NextRequest) {
  const validation = await validateWebSafeRequest(request);
  if (!validation.valid) {
    return webSafetyErrorResponse(validation.error);
  }

  const { clientId, token, consentType, formVersionHash, signatureData } =
    validation.body as {
      clientId: string;
      token: string;
      consentType: ConsentType;
      formVersionHash: string;
      signatureData: string;
    };

  if (!clientId || !token || !consentType || !formVersionHash || !signatureData) {
    return NextResponse.json(
      { error: "Missing required fields" },
      { status: 400 }
    );
  }

  const client = await db.query.clients.findFirst({
    where: and(
      eq(clients.id, clientId),
      eq(clients.magicLinkToken, token)
    ),
  });

  if (!client) {
    return NextResponse.json(
      { error: "Invalid client or token" },
      { status: 401 }
    );
  }

  if (client.magicLinkExpiresAt && new Date() > client.magicLinkExpiresAt) {
    return NextResponse.json({ error: "Link expired" }, { status: 401 });
  }

  const existingConsent = await db.query.consents.findFirst({
    where: and(
      eq(consents.clientId, clientId),
      eq(consents.consentType, consentType)
    ),
  });

  const ip = request.headers.get("x-forwarded-for") || "unknown";
  const userAgent = request.headers.get("user-agent") || "unknown";

  if (existingConsent) {
    await db
      .update(consents)
      .set({
        status: "signed",
        formVersionHash,
        signatureData,
        signedAt: new Date(),
        ipAddress: ip,
        userAgent,
        updatedAt: new Date(),
      })
      .where(eq(consents.id, existingConsent.id));
  } else {
    await db.insert(consents).values({
      id: generateId(),
      clientId,
      consentType,
      status: "signed",
      formVersionHash,
      signatureData,
      signedAt: new Date(),
      ipAddress: ip,
      userAgent,
    });
  }

  return NextResponse.json({ success: true });
}
