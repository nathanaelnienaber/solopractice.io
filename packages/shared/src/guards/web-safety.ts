/**
 * Web Safety Guards
 *
 * Runtime checks to ensure clinical data never crosses the web boundary.
 * Use these in API handlers to reject payloads containing PHI fields.
 */

export const CLINICAL_FIELD_BLOCKLIST = [
  "subjective",
  "objective",
  "assessment",
  "plan",
  "soapNote",
  "soap",
  "diagnosisCodes",
  "diagnosisCode",
  "diagnosis",
  "dx",
  "icd",
  "icd10",
  "procedureCodes",
  "procedureCode",
  "cpt",
  "cptCode",
  "recording",
  "recordingId",
  "audioPath",
  "audioFile",
  "transcript",
  "transcriptId",
  "transcriptContent",
  "clinicalNotes",
  "clinicalNote",
  "treatmentPlan",
  "mentalStatusExam",
  "mse",
  "superbill",
  "superbillId",
] as const;

export type ClinicalField = (typeof CLINICAL_FIELD_BLOCKLIST)[number];

export class WebSafetyViolationError extends Error {
  constructor(
    public readonly blockedFields: string[],
    message?: string
  ) {
    super(
      message ??
        `Web safety violation: payload contains clinical fields that must not leave desktop: ${blockedFields.join(", ")}`
    );
    this.name = "WebSafetyViolationError";
  }
}

export function findClinicalFields(obj: unknown, path = ""): string[] {
  if (obj === null || obj === undefined) return [];
  if (typeof obj !== "object") return [];

  const violations: string[] = [];

  for (const [key, value] of Object.entries(obj)) {
    const currentPath = path ? `${path}.${key}` : key;
    const lowerKey = key.toLowerCase();

    if (
      CLINICAL_FIELD_BLOCKLIST.some(
        (blocked) => lowerKey === blocked.toLowerCase()
      )
    ) {
      violations.push(currentPath);
    }

    if (typeof value === "object" && value !== null) {
      violations.push(...findClinicalFields(value, currentPath));
    }
  }

  return violations;
}

export function isWebSafePayload(payload: unknown): boolean {
  return findClinicalFields(payload).length === 0;
}

export function assertWebSafePayload(payload: unknown): void {
  const violations = findClinicalFields(payload);
  if (violations.length > 0) {
    throw new WebSafetyViolationError(violations);
  }
}
