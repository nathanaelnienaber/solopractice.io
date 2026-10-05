import { NextRequest, NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, therapists } from "@/db";
import { getSessionTherapist } from "@/lib/auth";
import { validateWebSafeRequest, webSafetyErrorResponse } from "@/lib/web-safety";

function publicTherapist(row: typeof therapists.$inferSelect) {
  return {
    id: row.id,
    email: row.email,
    firstName: row.firstName,
    lastName: row.lastName,
    credentials: row.credentials,
    licenseState: row.licenseState,
    practiceName: row.practiceName,
    updatedAt: row.updatedAt,
  };
}

function normalizeRequired(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function normalizeOptional(value: unknown): string | null {
  if (value === undefined || value === null) return null;
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export async function PATCH(request: NextRequest) {
  const therapist = await getSessionTherapist();
  if (!therapist) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const validation = await validateWebSafeRequest(request);
  if (!validation.valid) {
    return webSafetyErrorResponse(validation.error);
  }

  const body = validation.body as Record<string, unknown>;

  const firstName = normalizeRequired(body.firstName);
  const lastName = normalizeRequired(body.lastName);
  const credentials = normalizeRequired(body.credentials);
  const licenseStateRaw = normalizeRequired(body.licenseState);
  const practiceName = normalizeOptional(body.practiceName);

  if (!firstName || !lastName || !credentials || !licenseStateRaw) {
    return NextResponse.json(
      {
        error:
          "First name, last name, credentials, and license state are required",
      },
      { status: 400 }
    );
  }

  const licenseState = licenseStateRaw.toUpperCase();
  if (!/^[A-Z]{2}$/.test(licenseState)) {
    return NextResponse.json(
      { error: "License state must be a 2-letter code (e.g. FL)" },
      { status: 400 }
    );
  }

  const [updated] = await db
    .update(therapists)
    .set({
      firstName,
      lastName,
      credentials,
      licenseState,
      practiceName,
      updatedAt: new Date(),
    })
    .where(eq(therapists.id, therapist.id))
    .returning();

  if (!updated) {
    return NextResponse.json(
      { error: "Failed to update profile" },
      { status: 500 }
    );
  }

  return NextResponse.json({ therapist: publicTherapist(updated) });
}
