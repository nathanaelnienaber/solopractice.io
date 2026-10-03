import { NextRequest, NextResponse } from "next/server";
import { clearSession } from "@/lib/auth";

/**
 * POST /api/auth/logout
 *
 * Clears the session cookie. POST-only: a GET logout is triggerable by any
 * third-party <img> tag, which is a cross-site request forgery for logout.
 */
export async function POST(request: NextRequest) {
  await clearSession();

  const accepts = request.headers.get("accept") ?? "";
  if (accepts.includes("application/json")) {
    return NextResponse.json({ success: true });
  }

  return NextResponse.redirect(new URL("/therapist/login", request.url), {
    status: 303,
  });
}
