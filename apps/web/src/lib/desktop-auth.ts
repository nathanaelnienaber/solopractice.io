/**
 * Desktop app authentication.
 *
 * The desktop companion has no session cookie, so it presents a long-lived
 * per-therapist bearer secret in `X-Desktop-API-Key` (minted and rotated via
 * /api/therapist/desktop-api-key).
 *
 * SECURITY: the key identifies WHICH therapist is calling. It is not a shared
 * gate. Every desktop route must resolve the therapist from the key and then
 * scope its queries by that therapist's id — an endpoint that merely checks
 * "is this key valid" and then looks a record up by id alone is a cross-tenant
 * read of another therapist's clients.
 *
 * This lives in one place so the two desktop routes cannot drift apart again.
 */

import { db, therapists } from "@/db";
import { eq } from "drizzle-orm";
import type { NextRequest } from "next/server";

export const DESKTOP_API_KEY_HEADER = "X-Desktop-API-Key";

export type DesktopTherapist = NonNullable<
  Awaited<ReturnType<typeof findTherapistByDesktopKey>>
>;

async function findTherapistByDesktopKey(apiKey: string) {
  return db.query.therapists.findFirst({
    where: eq(therapists.desktopApiKey, apiKey),
  });
}

/**
 * Resolve the therapist owning the presented desktop API key, or null.
 *
 * Returns null for a missing, empty, or unknown key. Callers must treat null
 * as 401 and must never fall back to an environment-wide key.
 */
export async function authenticateDesktopRequest(request: NextRequest) {
  const apiKey = request.headers.get(DESKTOP_API_KEY_HEADER);

  if (!apiKey) {
    return null;
  }

  // A therapist row with a NULL desktop_api_key must never be matched by an
  // empty header value; `eq(col, "")` cannot match NULL in Postgres, but guard
  // explicitly rather than relying on that.
  if (apiKey.trim() === "") {
    return null;
  }

  return (await findTherapistByDesktopKey(apiKey)) ?? null;
}
