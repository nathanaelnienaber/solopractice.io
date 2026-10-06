/**
 * Web Safety Guard Tests
 *
 * These tests verify that clinical data is rejected at the API boundary.
 * Run with: pnpm test
 */

import { describe, it, expect } from "vitest";
import {
  assertWebSafePayload,
  findClinicalFields,
  isWebSafePayload,
  CLINICAL_FIELD_BLOCKLIST,
  WebSafetyViolationError,
} from "./web-safety.js";

describe("CLINICAL_FIELD_BLOCKLIST", () => {
  it("should include all SOAP fields", () => {
    expect(CLINICAL_FIELD_BLOCKLIST).toContain("subjective");
    expect(CLINICAL_FIELD_BLOCKLIST).toContain("objective");
    expect(CLINICAL_FIELD_BLOCKLIST).toContain("assessment");
    expect(CLINICAL_FIELD_BLOCKLIST).toContain("plan");
  });

  it("should include diagnosis/procedure codes", () => {
    expect(CLINICAL_FIELD_BLOCKLIST).toContain("diagnosisCodes");
    expect(CLINICAL_FIELD_BLOCKLIST).toContain("procedureCodes");
    expect(CLINICAL_FIELD_BLOCKLIST).toContain("cpt");
    expect(CLINICAL_FIELD_BLOCKLIST).toContain("icd10");
  });

  it("should include clinical media fields", () => {
    expect(CLINICAL_FIELD_BLOCKLIST).toContain("recording");
    expect(CLINICAL_FIELD_BLOCKLIST).toContain("transcript");
    expect(CLINICAL_FIELD_BLOCKLIST).toContain("audioFile");
  });
});

describe("findClinicalFields", () => {
  it("should return empty array for safe payloads", () => {
    const safePayload = {
      clientId: "123",
      firstName: "Test",
      lastName: "Client",
      email: "test@example.com",
    };
    expect(findClinicalFields(safePayload)).toEqual([]);
  });

  it("should detect top-level clinical fields", () => {
    const unsafePayload = {
      clientId: "123",
      subjective: "Patient reports anxiety",
    };
    expect(findClinicalFields(unsafePayload)).toContain("subjective");
  });

  it("should detect nested clinical fields", () => {
    const unsafePayload = {
      clientId: "123",
      session: {
        soapNote: {
          subjective: "...",
          objective: "...",
        },
      },
    };
    const fields = findClinicalFields(unsafePayload);
    expect(fields).toContain("session.soapNote");
    expect(fields).toContain("session.soapNote.subjective");
    expect(fields).toContain("session.soapNote.objective");
  });

  it("should be case-insensitive", () => {
    const unsafePayload = {
      SUBJECTIVE: "...",
      DiagnosisCodes: [],
    };
    const fields = findClinicalFields(unsafePayload);
    expect(fields.length).toBeGreaterThan(0);
  });

  it("should detect array elements with clinical fields", () => {
    const unsafePayload = {
      items: [
        { id: 1, transcript: "..." },
      ],
    };
    const fields = findClinicalFields(unsafePayload);
    expect(fields).toContain("items.0.transcript");
  });
});

describe("isWebSafePayload", () => {
  it("should return true for safe payloads", () => {
    expect(isWebSafePayload({ clientId: "123", email: "a@b.com" })).toBe(true);
    expect(isWebSafePayload({ amountCents: 15000, dueDate: "2024-01-01" })).toBe(true);
    expect(isWebSafePayload(null)).toBe(true);
    expect(isWebSafePayload(undefined)).toBe(true);
  });

  it("should return false for unsafe payloads", () => {
    expect(isWebSafePayload({ soapNote: {} })).toBe(false);
    expect(isWebSafePayload({ diagnosisCodes: [] })).toBe(false);
    expect(isWebSafePayload({ recording: "path/to/file.wav" })).toBe(false);
  });
});

describe("assertWebSafePayload", () => {
  it("should not throw for safe payloads", () => {
    expect(() => assertWebSafePayload({ clientId: "123" })).not.toThrow();
    expect(() => assertWebSafePayload({ status: "pending" })).not.toThrow();
  });

  it("should throw WebSafetyViolationError for unsafe payloads", () => {
    expect(() => assertWebSafePayload({ transcript: "..." }))
      .toThrow(WebSafetyViolationError);
  });

  it("should include blocked fields in error", () => {
    try {
      assertWebSafePayload({
        subjective: "...",
        objective: "...",
        assessment: "...",
        plan: "...",
      });
      expect.fail("Should have thrown");
    } catch (e) {
      if (e instanceof WebSafetyViolationError) {
        expect(e.blockedFields).toContain("subjective");
        expect(e.blockedFields).toContain("objective");
        expect(e.blockedFields).toContain("assessment");
        expect(e.blockedFields).toContain("plan");
      } else {
        throw e;
      }
    }
  });
});

describe("Real-world attack scenarios", () => {
  it("should block attempt to sync SOAP note to web", () => {
    const attackPayload = {
      type: "sync",
      sessionId: "abc",
      soapNote: {
        subjective: "Client reports severe depression",
        objective: "Flat affect, poor eye contact",
        assessment: "MDD, recurrent, severe",
        plan: "Increase medication dosage",
      },
    };
    expect(isWebSafePayload(attackPayload)).toBe(false);
    expect(() => assertWebSafePayload(attackPayload)).toThrow();
  });

  it("should block attempt to upload transcript", () => {
    const attackPayload = {
      action: "backup",
      transcriptContent: "Full session transcript here...",
    };
    expect(isWebSafePayload(attackPayload)).toBe(false);
  });

  it("should block superbill data with CPT codes", () => {
    const attackPayload = {
      invoiceId: "inv-123",
      cptCodes: ["90834", "90837"],
      diagnosisCode: "F32.1",
    };
    expect(isWebSafePayload(attackPayload)).toBe(false);
  });

  it("should block DOB and superbill PDF fields on web payloads", () => {
    expect(
      isWebSafePayload({ invoiceId: "inv-1", dateOfBirth: "1990-01-01" })
    ).toBe(false);
    expect(
      isWebSafePayload({ invoiceId: "inv-1", clientDob: "1990-01-01" })
    ).toBe(false);
    expect(
      isWebSafePayload({ invoiceId: "inv-1", superbillPdf: "base64..." })
    ).toBe(false);
  });

  it("should allow superbill request status fields (ops only)", () => {
    const safePayload = {
      invoiceId: "inv-123",
      superbillRequestStatus: "requested",
      action: "mark_sent",
    };
    expect(isWebSafePayload(safePayload)).toBe(true);
  });

  it("should allow legitimate web ops data", () => {
    const safePayload = {
      clientId: "client-123",
      amountCents: 15000,
      description: "Therapy session",
      dueDate: "2024-12-01",
      status: "sent",
    };
    expect(isWebSafePayload(safePayload)).toBe(true);
    expect(() => assertWebSafePayload(safePayload)).not.toThrow();
  });
});
