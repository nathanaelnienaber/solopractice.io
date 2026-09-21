/**
 * Authentication Utilities
 *
 * Stub implementation for MVP:
 * - Therapist: email magic link
 * - Client: magic link only (no password)
 */

import { nanoid } from "nanoid";
import { cookies } from "next/headers";
import { db, therapists, clients } from "@/db";
import { eq } from "drizzle-orm";

const SESSION_COOKIE = "sp_session";
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

export async function getSessionTherapist() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const [type, id] = sessionCookie.value.split(":");
    if (type !== "therapist" || !id) {
      return null;
    }

    const therapist = await db.query.therapists.findFirst({
      where: eq(therapists.id, id),
    });

    return therapist ?? null;
  } catch {
    return null;
  }
}

export async function getSessionClient() {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get(SESSION_COOKIE);

  if (!sessionCookie?.value) {
    return null;
  }

  try {
    const [type, id] = sessionCookie.value.split(":");
    if (type !== "client" || !id) {
      return null;
    }

    const client = await db.query.clients.findFirst({
      where: eq(clients.id, id),
    });

    return client ?? null;
  } catch {
    return null;
  }
}

export async function setSession(
  type: "therapist" | "client",
  id: string
): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, `${type}:${id}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24 * 7,
    path: "/",
  });
}

export async function clearSession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}
