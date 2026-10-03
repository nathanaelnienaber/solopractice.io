import { describe, it, expect, afterEach } from "vitest";
import {
  signToken,
  verifyToken,
  getSessionSecret,
  TOKEN_PURPOSES,
  THERAPIST_SESSION_TTL_MS,
} from "./session-token";

const SECRET = "test-secret-at-least-32-chars-long-padding";
const OTHER_SECRET = "a-different-secret-also-32-chars-long-xxxx";
const THERAPIST_A = "therapist_aaaaaaaaaaaaaaaa";
const THERAPIST_B = "therapist_bbbbbbbbbbbbbbbb";

describe("signToken / verifyToken", () => {
  it("round-trips a valid token", () => {
    const token = signToken(
      TOKEN_PURPOSES.therapistSession,
      THERAPIST_A,
      THERAPIST_SESSION_TTL_MS,
      { secret: SECRET },
    );

    const result = verifyToken(token, TOKEN_PURPOSES.therapistSession, {
      secret: SECRET,
    });

    expect(result.valid).toBe(true);
    if (result.valid) {
      expect(result.payload.subject).toBe(THERAPIST_A);
    }
  });

  it("emits the versioned three-segment wire format", () => {
    const token = signToken(
      TOKEN_PURPOSES.therapistSession,
      THERAPIST_A,
      THERAPIST_SESSION_TTL_MS,
      { secret: SECRET },
    );
    const parts = token.split(".");
    expect(parts).toHaveLength(3);
    expect(parts[0]).toBe("v1");
  });

  it("does not leave the therapist id in cleartext in the cookie value", () => {
    // Not confidentiality (base64 is reversible) -- this asserts the raw id is
    // not directly greppable/editable, so the old `therapist:<id>` shape can
    // never silently come back.
    const token = signToken(
      TOKEN_PURPOSES.therapistSession,
      THERAPIST_A,
      THERAPIST_SESSION_TTL_MS,
      { secret: SECRET },
    );
    expect(token).not.toContain(`therapist:${THERAPIST_A}`);
  });
});

describe("forged and tampered tokens are rejected", () => {
  it("rejects the legacy unsigned 'therapist:<id>' cookie outright", () => {
    const result = verifyToken(
      `therapist:${THERAPIST_B}`,
      TOKEN_PURPOSES.therapistSession,
      { secret: SECRET },
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("malformed");
  });

  it("rejects a token whose payload was swapped to another therapist id", () => {
    // The core attack: attacker holds a valid session for A, re-points the
    // payload at B, keeps the (now wrong) signature.
    const token = signToken(
      TOKEN_PURPOSES.therapistSession,
      THERAPIST_A,
      THERAPIST_SESSION_TTL_MS,
      { secret: SECRET },
    );
    const [version, , signature] = token.split(".");

    const forgedPayload = Buffer.from(
      `${TOKEN_PURPOSES.therapistSession}:${THERAPIST_B}:${Date.now() + 60_000}`,
      "utf8",
    ).toString("base64url");

    const result = verifyToken(
      `${version}.${forgedPayload}.${signature}`,
      TOKEN_PURPOSES.therapistSession,
      { secret: SECRET },
    );

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("bad_signature");
  });

  it("rejects a token signed with a secret we do not hold", () => {
    const token = signToken(
      TOKEN_PURPOSES.therapistSession,
      THERAPIST_A,
      THERAPIST_SESSION_TTL_MS,
      { secret: OTHER_SECRET },
    );

    const result = verifyToken(token, TOKEN_PURPOSES.therapistSession, {
      secret: SECRET,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("bad_signature");
  });

  it("rejects a token with the signature stripped off", () => {
    const token = signToken(
      TOKEN_PURPOSES.therapistSession,
      THERAPIST_A,
      THERAPIST_SESSION_TTL_MS,
      { secret: SECRET },
    );
    const [version, payload] = token.split(".");

    const result = verifyToken(
      `${version}.${payload}.`,
      TOKEN_PURPOSES.therapistSession,
      { secret: SECRET },
    );
    expect(result.valid).toBe(false);
  });

  it("rejects a single-bit flip in the signature", () => {
    const token = signToken(
      TOKEN_PURPOSES.therapistSession,
      THERAPIST_A,
      THERAPIST_SESSION_TTL_MS,
      { secret: SECRET },
    );
    const [version, payload, signature] = token.split(".");
    const flipped =
      signature!.slice(0, -1) + (signature!.endsWith("A") ? "B" : "A");

    const result = verifyToken(
      `${version}.${payload}.${flipped}`,
      TOKEN_PURPOSES.therapistSession,
      { secret: SECRET },
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("bad_signature");
  });

  it("rejects an unknown token version", () => {
    const token = signToken(
      TOKEN_PURPOSES.therapistSession,
      THERAPIST_A,
      THERAPIST_SESSION_TTL_MS,
      { secret: SECRET },
    );
    const [, payload, signature] = token.split(".");

    const result = verifyToken(
      `v2.${payload}.${signature}`,
      TOKEN_PURPOSES.therapistSession,
      { secret: SECRET },
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("bad_version");
  });

  it.each([null, undefined, "", "garbage", "a.b", "....", "v1..."])(
    "rejects junk input %p",
    (input) => {
      const result = verifyToken(
        input as string | null | undefined,
        TOKEN_PURPOSES.therapistSession,
        { secret: SECRET },
      );
      expect(result.valid).toBe(false);
    },
  );
});

describe("expiry is enforced from inside the signed payload", () => {
  it("rejects a token past its expiry even though the signature is valid", () => {
    const issuedAt = Date.now();
    const token = signToken(
      TOKEN_PURPOSES.therapistSession,
      THERAPIST_A,
      THERAPIST_SESSION_TTL_MS,
      { secret: SECRET, now: issuedAt },
    );

    // Valid right now...
    expect(
      verifyToken(token, TOKEN_PURPOSES.therapistSession, {
        secret: SECRET,
        now: issuedAt,
      }).valid,
    ).toBe(true);

    // ...and dead one millisecond past the TTL.
    const result = verifyToken(token, TOKEN_PURPOSES.therapistSession, {
      secret: SECRET,
      now: issuedAt + THERAPIST_SESSION_TTL_MS + 1,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("expired");
  });

  it("rejects a token whose expiry was extended by hand", () => {
    const forgedPayload = Buffer.from(
      `${TOKEN_PURPOSES.therapistSession}:${THERAPIST_A}:${Date.now() + 10 * 365 * 24 * 60 * 60 * 1000}`,
      "utf8",
    ).toString("base64url");

    const result = verifyToken(
      `v1.${forgedPayload}.not-a-real-signature`,
      TOKEN_PURPOSES.therapistSession,
      { secret: SECRET },
    );
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("bad_signature");
  });

  it("treats the exact expiry instant as expired", () => {
    const issuedAt = Date.now();
    const token = signToken(TOKEN_PURPOSES.therapistSession, THERAPIST_A, 1000, {
      secret: SECRET,
      now: issuedAt,
    });
    const result = verifyToken(token, TOKEN_PURPOSES.therapistSession, {
      secret: SECRET,
      now: issuedAt + 1000,
    });
    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("expired");
  });
});

describe("purpose domain separation", () => {
  it("will not accept a magic-link token as a session cookie", () => {
    const magicLink = signToken(
      TOKEN_PURPOSES.therapistMagicLink,
      THERAPIST_A,
      THERAPIST_SESSION_TTL_MS,
      { secret: SECRET },
    );

    const result = verifyToken(magicLink, TOKEN_PURPOSES.therapistSession, {
      secret: SECRET,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("purpose_mismatch");
  });

  it("will not accept a client session as a therapist session", () => {
    const clientSession = signToken(
      TOKEN_PURPOSES.clientSession,
      THERAPIST_A,
      THERAPIST_SESSION_TTL_MS,
      { secret: SECRET },
    );

    const result = verifyToken(clientSession, TOKEN_PURPOSES.therapistSession, {
      secret: SECRET,
    });

    expect(result.valid).toBe(false);
    if (!result.valid) expect(result.reason).toBe("purpose_mismatch");
  });
});

describe("signing input validation", () => {
  it("refuses to sign a subject containing the payload delimiter", () => {
    // Guards against payload-grammar confusion, e.g. a subject of
    // "x:9999999999999" smuggling in its own expiry field.
    expect(() =>
      signToken(TOKEN_PURPOSES.therapistSession, "abc:999", 1000, {
        secret: SECRET,
      }),
    ).toThrow();
  });

  it("refuses a non-positive TTL", () => {
    expect(() =>
      signToken(TOKEN_PURPOSES.therapistSession, THERAPIST_A, 0, {
        secret: SECRET,
      }),
    ).toThrow();
  });
});

describe("getSessionSecret fails closed", () => {
  const original = process.env.SESSION_SECRET;
  afterEach(() => {
    process.env.SESSION_SECRET = original;
  });

  it("throws when the secret is unset", () => {
    delete process.env.SESSION_SECRET;
    expect(() => getSessionSecret()).toThrow(/SESSION_SECRET/);
  });

  it("throws when the secret is too short to be meaningful", () => {
    process.env.SESSION_SECRET = "short";
    expect(() => getSessionSecret()).toThrow(/SESSION_SECRET/);
  });

  it("returns the secret when adequately long", () => {
    process.env.SESSION_SECRET = SECRET;
    expect(getSessionSecret()).toBe(SECRET);
  });
});
