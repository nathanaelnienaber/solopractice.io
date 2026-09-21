import { NextRequest, NextResponse } from "next/server";
import { db, therapists } from "@/db";
import { eq } from "drizzle-orm";
import { setSession } from "@/lib/auth";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const token = searchParams.get("token");
  const id = searchParams.get("id");

  if (!token || !id) {
    return NextResponse.redirect(
      new URL("/therapist/login?error=invalid", request.url)
    );
  }

  const therapist = await db.query.therapists.findFirst({
    where: eq(therapists.id, id),
  });

  if (!therapist) {
    return NextResponse.redirect(
      new URL("/therapist/login?error=not_found", request.url)
    );
  }

  await setSession("therapist", therapist.id);

  return NextResponse.redirect(new URL("/therapist/dashboard", request.url));
}
