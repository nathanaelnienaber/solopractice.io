import { NextRequest, NextResponse } from "next/server";
import { db, therapists } from "@/db";
import { eq } from "drizzle-orm";
import { setSession, verifyTherapistMagicLinkToken } from "@/lib/auth";

/**
 * GET /api/auth/therapist/verify?token=<signed>
 *
 * Redeems a signed magic-link token and opens a session.
 *
 * The therapist id is read from INSIDE the signed token, never from a query
 * parameter. The previous implementation took `?id=` straight from the URL and
 * never checked `token` at all, so requesting this route with any known
 * therapist id minted a valid session for that therapist -- a complete
 * authentication bypass.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token");

  const therapistId = verifyTherapistMagicLinkToken(token);
  if (!therapistId) {
    return NextResponse.redirect(
      new URL("/therapist/login?error=invalid_or_expired", request.url),
    );
  }

  const therapist = await db.query.therapists.findFirst({
    where: eq(therapists.id, therapistId),
  });

  if (!therapist) {
    return NextResponse.redirect(
      new URL("/therapist/login?error=not_found", request.url),
    );
  }

  await setSession("therapist", therapist.id);

  return NextResponse.redirect(new URL("/therapist/dashboard", request.url));
}
