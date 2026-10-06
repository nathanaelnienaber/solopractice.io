import { NextRequest, NextResponse } from "next/server";
import { db, therapists } from "@/db";
import { eq } from "drizzle-orm";
import { generateId, signTherapistMagicLinkToken } from "@/lib/auth";
import { sendMagicLink } from "@/lib/email";

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();

    if (!email || typeof email !== "string") {
      return NextResponse.json({ error: "Email required" }, { status: 400 });
    }

    const existing = await db.query.therapists.findFirst({
      where: eq(therapists.email, email.toLowerCase()),
    });

    const therapist =
      existing ??
      (await db
        .insert(therapists)
        .values({
          id: generateId(),
          email: email.toLowerCase(),
          firstName: "New",
          lastName: "Therapist",
          credentials: "LMHC",
          licenseState: "FL",
        })
        .returning()
        .then((rows) => {
          const created = rows[0];
          if (!created) {
            throw new Error("Failed to create therapist record");
          }
          return created;
        }));

    if (!therapist) {
      throw new Error("Could not resolve therapist for magic link");
    }

    const token = signTherapistMagicLinkToken(therapist.id);
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    // The therapist id is carried inside the signed token, not as a separate
    // query parameter the recipient could edit.
    const magicLinkUrl = `${baseUrl}/api/auth/therapist/verify?token=${encodeURIComponent(token)}`;

    await sendMagicLink(email, magicLinkUrl, "therapist");

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Magic link error:", error);
    return NextResponse.json(
      { error: "Couldn't send sign-in link" },
      { status: 500 }
    );
  }
}
