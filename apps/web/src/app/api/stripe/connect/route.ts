import { NextRequest, NextResponse } from "next/server";
import { db, therapists } from "@/db";
import { eq } from "drizzle-orm";
import { getSessionTherapist } from "@/lib/auth";
import { createConnectedAccount, createConnectAccountLink } from "@/lib/stripe";

export async function POST(request: NextRequest) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin;
    let accountId = therapist.stripeConnectedAccountId;

    if (!accountId) {
      const account = await createConnectedAccount(therapist.email);
      accountId = account.id;

      await db
        .update(therapists)
        .set({
          stripeConnectedAccountId: accountId,
          updatedAt: new Date(),
        })
        .where(eq(therapists.id, therapist.id));
    }

    const url = await createConnectAccountLink(
      accountId,
      `${baseUrl}/therapist/settings?stripe=refresh`,
      `${baseUrl}/therapist/settings?stripe=complete`
    );

    return NextResponse.json({ url });
  } catch (error) {
    console.error("Stripe connect error:", error);
    return NextResponse.json(
      { error: "Failed to create Stripe link" },
      { status: 500 }
    );
  }
}
