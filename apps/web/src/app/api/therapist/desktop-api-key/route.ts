import { NextRequest, NextResponse } from "next/server";
import { db, therapists } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionTherapist, generateId } from "@/lib/auth";
import { nanoid } from "nanoid";

/**
 * Generate or retrieve Desktop API Key
 * 
 * This key is used by the desktop app to sync client data.
 * It's a long-lived token stored in the therapist's settings.
 */

function generateDesktopApiKey(): string {
  // Generate a secure, readable API key
  // Format: sp_desktop_<random>
  return `sp_desktop_${nanoid(32)}`;
}

export async function GET() {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Return existing key info (not the full key for security, just if it exists)
  return NextResponse.json({
    hasApiKey: !!therapist.desktopApiKey,
    createdAt: therapist.desktopApiKeyCreatedAt,
    // Only show partial key for identification
    keyPreview: therapist.desktopApiKey 
      ? `${therapist.desktopApiKey.slice(0, 15)}...${therapist.desktopApiKey.slice(-4)}`
      : null,
  });
}

export async function POST() {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Generate new API key
  const apiKey = generateDesktopApiKey();
  const now = new Date();

  await db
    .update(therapists)
    .set({
      desktopApiKey: apiKey,
      desktopApiKeyCreatedAt: now,
      updatedAt: now,
    })
    .where(eq(therapists.id, therapist.id));

  // Return the full key ONLY on creation (this is the only time it's shown)
  return NextResponse.json({
    apiKey,
    createdAt: now.toISOString(),
    message: "Save this key - it will only be shown once!",
  });
}

export async function DELETE() {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Revoke API key
  await db
    .update(therapists)
    .set({
      desktopApiKey: null,
      desktopApiKeyCreatedAt: null,
      updatedAt: new Date(),
    })
    .where(eq(therapists.id, therapist.id));

  return NextResponse.json({ success: true, message: "API key revoked" });
}
