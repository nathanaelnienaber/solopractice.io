/**
 * Authentication Utilities
 *
 * - Therapist: email magic link (signed, short-lived)
 * - Client: magic link only (no password)
 *
 * Session cookies are HMAC-signed and carry an absolute expiry inside the
 * signed payload. See lib/session-token.ts for the wire format and rationale.
 */

import { nanoid } from "nanoid";
import { cookies } from "next/headers";
import { db, therapists, clients } from "@/db";
import { eq } from "drizzle-orm";
import {
  SESSION_COOKIE,
  TOKEN_PURPOSES,
  THERAPIST_SESSION_TTL_MS,
  CLIENT_SESSION_TTL_MS,
  THERAPIST_MAGIC_LINK_TTL_MS,
  signToken,
  verifyToken,
  type TokenPurpose,
} from "@/lib/session-token";

export { SESSION_COOKIE };

const TOKEN_EXPIRY_HOURS = 1;
const CLIENT_TOKEN_EXPIRY_DAYS = 7;

export function generateMagicLinkToken(): string {
  return nanoid(32);
}

export function generateId(): string {
  return nanoid(21);
}

export function getTokenExpiry(type: "therapist" | "client"): Date {
  const now = new Date();
  if (type === "therapist") {
    now.setHours(now.getHours() + TOKEN_EXPIRY_HOURS);
  } else {
    now.setDate(now.getDate() + CLIENT_TOKEN_EXPIRY_DAYS);
  }
  return now;
}

/**
 * Mints a signed, 15-minute magic-link token for a therapist.
 *
 * Stateless by design: the therapists table has no column to store a
 * magic-link token, and adding one is a schema migration (needs sign-off).
 * The signature is what makes the link unforgeable, so no server-side
 * lookup is required to prove the link came from us.
 *
 * Known limitation: being stateless, this token is valid for its full 15
 * minutes and is not single-use. Burning it on redemption requires a
 * `therapists.magic_link_token`/`used_at` column. Tracked, not fixed here.
 */
export function signTherapistMagicLinkToken(therapistId: string): string {
  return signToken(
    TOKEN_PURPOSES.therapistMagicLink,
    therapistId,
    THERAPIST_MAGIC_LINK_TTL_MS,
  );
}

/**
 * Verifies a therapist magic-link token and returns the therapist id it was
 * minted for, or null when the token is forged, tampered with, replayed from
 * another purpose, or expired.
 */
export function verifyTherapistMagicLinkToken(
  token: string | null | undefined,
): string | null {
  try {
    const result = verifyToken(token, TOKEN_PURPOSES.therapistMagicLink);
    if (!result.valid) {
      console.warn(`[auth] rejected therapist magic link: ${result.reason}`);
      return null;
    }
    return result.payload.subject;
  } catch (error) {
    // Thrown only when SESSION_SECRET is missing/weak. Fail closed.
    console.error("[auth] magic link verification unavailable:", error);
    return null;
  }
}

/**
 * Reads the session cookie and returns the verified subject id for the given
 * purpose, or null. Signature and expiry are checked before the embedded id
 * is trusted; a tampered or expired cookie is rejected, never accepted.
 */
async function getVerifiedSubject(
  purpose: TokenPurpose,
): Promise<string | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  try {
    const result = verifyToken(sessionCookie?.value, purpose);
    if (!result.valid) {
      if (result.reason !== "absent" && result.reason !== "purpose_mismatch") {
        // Worth seeing in logs: these are tampering or stale-session signals.
        console.warn(`[auth] rejected session cookie: ${result.reason}`);
      }
      return null;
    }
    return result.payload.subject;
  } catch (error) {
    console.error("[auth] session verification unavailable:", error);
    return null;
  }
}

export async function getSessionTherapist() {
  const therapistId = await getVerifiedSubject(TOKEN_PURPOSES.therapistSession);
  if (!therapistId) {
    return null;
  }

  const therapist = await db.query.therapists.findFirst({
    where: eq(therapists.id, therapistId),
  });

  return therapist ?? null;
}

export async function getSessionClient() {
  const clientId = await getVerifiedSubject(TOKEN_PURPOSES.clientSession);
  if (!clientId) {
    return null;
  }

  const client = await db.query.clients.findFirst({
    where: eq(clients.id, clientId),
  });

  return client ?? null;
}

export async function setSession(
  type: "therapist" | "client",
  id: string,
): Promise<void> {
  const purpose =
    type === "therapist"
      ? TOKEN_PURPOSES.therapistSession
      : TOKEN_PURPOSES.clientSession;
  const ttlMs =
    type === "therapist" ? THERAPIST_SESSION_TTL_MS : CLIENT_SESSION_TTL_MS;

  const token = signToken(purpose, id, ttlMs);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    // Mirrors the signed expiry so the browser drops the cookie on its own.
    // The signed payload remains the authoritative check.
    maxAge: Math.floor(ttlMs / 1000),
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  // delete() alone can leave the cookie in place when attributes differ, so
  // also overwrite it with an already-expired value on the same path.
  cookieStore.set(SESSION_COOKIE, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 0,
    path: "/",
  });
  cookieStore.delete(SESSION_COOKIE);
}
