/**
 * Signed, self-contained bearer tokens (session cookies and magic links).
 *
 * Wire format:
 *   v1.<base64url(payload)>.<base64url(HMAC-SHA256(base64url(payload)))>
 *   payload = "<purpose>:<subject>:<expiresAtEpochMs>"
 *
 * Design notes:
 * - The HMAC is computed over the ENCODED payload segment, so there is exactly
 *   one byte sequence that can produce a given signature. Verification happens
 *   BEFORE the payload is parsed: untrusted bytes are never interpreted until
 *   the signature proves we minted them.
 * - `purpose` is domain separation. A magic-link token and a session cookie are
 *   both signed with the same secret, so without a purpose bound into the
 *   signed payload a 15-minute magic-link token could be pasted in as a
 *   12-hour session cookie.
 * - Expiry lives INSIDE the signed payload. A cookie `maxAge` is a client-side
 *   hint the browser is free to ignore; it is not an authorization control.
 * - Fail closed: a missing or weak secret throws rather than degrading to
 *   unsigned tokens.
 */

import { createHmac, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "sp_session";

const TOKEN_VERSION = "v1";
const MIN_SECRET_LENGTH = 32;

export const TOKEN_PURPOSES = {
  therapistSession: "session.therapist",
  clientSession: "session.client",
  therapistMagicLink: "magiclink.therapist",
} as const;

export type TokenPurpose = (typeof TOKEN_PURPOSES)[keyof typeof TOKEN_PURPOSES];

/**
 * Absolute lifetimes.
 *
 * Therapist sessions are 12h: the dashboard exposes PHI and a live Stripe
 * Connect account, so a stolen cookie must not be usable indefinitely. 12h
 * covers one working day, and re-auth costs the therapist one emailed link.
 * Magic links are short-lived because they arrive over email, which is the
 * weakest link in the chain.
 */
export const THERAPIST_SESSION_TTL_MS = 12 * 60 * 60 * 1000;
export const CLIENT_SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
export const THERAPIST_MAGIC_LINK_TTL_MS = 15 * 60 * 1000;

/** nanoid's default alphabet. Keeps `:` out of the subject so the payload
 *  grammar stays unambiguous. */
const SUBJECT_PATTERN = /^[A-Za-z0-9_-]{1,64}$/;

export interface TokenPayload {
  purpose: TokenPurpose;
  subject: string;
  expiresAt: number;
}

export type TokenFailureReason =
  | "absent"
  | "malformed"
  | "bad_version"
  | "bad_signature"
  | "bad_payload"
  | "purpose_mismatch"
  | "expired";

export type VerifyResult =
  | { valid: true; payload: TokenPayload }
  | { valid: false; reason: TokenFailureReason };

/**
 * Reads the server-side signing secret.
 *
 * Throws when unset or too short. Callers that sit on a request path should
 * catch and treat it as "no session" so a misconfigured deploy locks everyone
 * out instead of silently trusting forged cookies.
 */
export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < MIN_SECRET_LENGTH) {
    throw new Error(
      `SESSION_SECRET is missing or shorter than ${MIN_SECRET_LENGTH} characters; ` +
        "refusing to issue or trust session tokens.",
    );
  }
  return secret;
}

function encodeSegment(value: string): string {
  return Buffer.from(value, "utf8").toString("base64url");
}

function sign(encodedPayload: string, secret: string): string {
  return createHmac("sha256", secret).update(encodedPayload).digest("base64url");
}

/** Constant-time compare of two ASCII signature strings. */
function signaturesMatch(a: string, b: string): boolean {
  const left = Buffer.from(a, "utf8");
  const right = Buffer.from(b, "utf8");
  // timingSafeEqual throws on length mismatch; a differing length is already a
  // public fact about a malformed token, so short-circuit it.
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
}

export function signToken(
  purpose: TokenPurpose,
  subject: string,
  ttlMs: number,
  options: { now?: number; secret?: string } = {},
): string {
  if (!SUBJECT_PATTERN.test(subject)) {
    throw new Error("Refusing to sign a token for a malformed subject id.");
  }
  if (!Number.isFinite(ttlMs) || ttlMs <= 0) {
    throw new Error("Refusing to sign a token with a non-positive TTL.");
  }

  const secret = options.secret ?? getSessionSecret();
  const now = options.now ?? Date.now();
  const expiresAt = now + ttlMs;

  const encodedPayload = encodeSegment(`${purpose}:${subject}:${expiresAt}`);
  return `${TOKEN_VERSION}.${encodedPayload}.${sign(encodedPayload, secret)}`;
}

/**
 * Verifies signature, then purpose, then expiry. Returns a typed failure
 * reason instead of throwing so callers can log without branching on strings.
 */
export function verifyToken(
  token: string | null | undefined,
  expectedPurpose: TokenPurpose,
  options: { now?: number; secret?: string } = {},
): VerifyResult {
  if (!token) {
    return { valid: false, reason: "absent" };
  }

  const secret = options.secret ?? getSessionSecret();
  const now = options.now ?? Date.now();

  const parts = token.split(".");
  if (parts.length !== 3) {
    return { valid: false, reason: "malformed" };
  }

  const [version, encodedPayload, providedSignature] = parts;
  if (version !== TOKEN_VERSION) {
    return { valid: false, reason: "bad_version" };
  }
  if (!encodedPayload || !providedSignature) {
    return { valid: false, reason: "malformed" };
  }

  // Signature first. Nothing below this line trusts the payload bytes.
  if (!signaturesMatch(sign(encodedPayload, secret), providedSignature)) {
    return { valid: false, reason: "bad_signature" };
  }

  const raw = Buffer.from(encodedPayload, "base64url").toString("utf8");
  const segments = raw.split(":");
  if (segments.length !== 3) {
    return { valid: false, reason: "bad_payload" };
  }

  const [purpose, subject, expiresAtRaw] = segments;
  if (!SUBJECT_PATTERN.test(subject ?? "")) {
    return { valid: false, reason: "bad_payload" };
  }
  if (!/^\d+$/.test(expiresAtRaw ?? "")) {
    return { valid: false, reason: "bad_payload" };
  }

  const expiresAt = Number(expiresAtRaw);
  if (!Number.isSafeInteger(expiresAt)) {
    return { valid: false, reason: "bad_payload" };
  }

  if (purpose !== expectedPurpose) {
    return { valid: false, reason: "purpose_mismatch" };
  }

  if (expiresAt <= now) {
    return { valid: false, reason: "expired" };
  }

  return {
    valid: true,
    payload: { purpose: expectedPurpose, subject: subject!, expiresAt },
  };
}
