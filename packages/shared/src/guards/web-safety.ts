/**
 * Web safety guards — runtime enforcement of PHI boundary.
 *
 * These functions MUST be called before any data is serialized to web payloads.
 * Tests verify that clinical fields cannot pass through these guards.
 */

import { CLINICAL_FIELD_NAMES, type ClinicalFieldName } from '../types/clinical';

/**
 * Error thrown when clinical data is detected in a web payload.
 */
export class PHIBoundaryViolationError extends Error {
  constructor(
    public readonly field: string,
    public readonly context?: string
  ) {
    super(
      `PHI BOUNDARY VIOLATION: Clinical field "${field}" detected in web payload.` +
        (context ? ` Context: ${context}` : '') +
        ' Clinical data must NEVER leave the desktop.'
    );
    this.name = 'PHIBoundaryViolationError';
  }
}

/**
 * Check if a field name is clinical (must never be in web payloads).
 */
export function isClinicalField(fieldName: string): fieldName is ClinicalFieldName {
  return (CLINICAL_FIELD_NAMES as readonly string[]).includes(fieldName);
}

/**
 * Recursively scan an object for clinical fields.
 * Returns the first clinical field found, or null if none.
 */
export function findClinicalFields(
  obj: unknown,
  path: string = ''
): { field: string; path: string } | null {
  if (obj === null || obj === undefined) {
    return null;
  }

  if (Array.isArray(obj)) {
    for (let i = 0; i < obj.length; i++) {
      const result = findClinicalFields(obj[i], `${path}[${i}]`);
      if (result) return result;
    }
    return null;
  }

  if (typeof obj === 'object') {
    for (const key of Object.keys(obj)) {
      // Check if this key is a clinical field
      if (isClinicalField(key)) {
        return { field: key, path: path ? `${path}.${key}` : key };
      }
      // Recurse into value
      const result = findClinicalFields(
        (obj as Record<string, unknown>)[key],
        path ? `${path}.${key}` : key
      );
      if (result) return result;
    }
  }

  return null;
}

/**
 * Assert that a payload is web-safe (contains no clinical fields).
 * Throws PHIBoundaryViolationError if clinical data is detected.
 *
 * MUST be called before serializing any data to:
 * - HTTP responses
 * - WebSocket messages
 * - localStorage that syncs
 * - Any network payload
 */
export function assertWebSafePayload<T>(payload: T, context?: string): T {
  const violation = findClinicalFields(payload);
  if (violation) {
    throw new PHIBoundaryViolationError(violation.field, context);
  }
  return payload;
}

/**
 * Create a web-safe version of a payload by stripping clinical fields.
 * Use when you need to derive web-safe data from desktop records.
 *
 * WARNING: Prefer using properly typed web-safe interfaces instead.
 * This is a last resort for legacy code paths.
 */
export function stripClinicalFields<T extends Record<string, unknown>>(
  obj: T
): Partial<T> {
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(obj)) {
    if (isClinicalField(key)) {
      continue; // Skip clinical fields
    }

    if (Array.isArray(value)) {
      result[key] = value.map((item) =>
        typeof item === 'object' && item !== null
          ? stripClinicalFields(item as Record<string, unknown>)
          : item
      );
    } else if (typeof value === 'object' && value !== null) {
      result[key] = stripClinicalFields(value as Record<string, unknown>);
    } else {
      result[key] = value;
    }
  }

  return result as Partial<T>;
}

/**
 * Type guard to check if a payload contains any clinical fields.
 * Returns true if the payload is SAFE (no clinical fields).
 */
export function isWebSafe(payload: unknown): boolean {
  return findClinicalFields(payload) === null;
}

/**
 * Wrap an object in a Proxy that throws on access to clinical fields.
 * Useful for development/testing to catch accidental PHI access.
 */
export function createWebSafeProxy<T extends object>(obj: T): T {
  return new Proxy(obj, {
    get(target, prop) {
      if (typeof prop === 'string' && isClinicalField(prop)) {
        throw new PHIBoundaryViolationError(
          prop,
          'Attempted to access clinical field through web-safe proxy'
        );
      }
      const value = Reflect.get(target, prop);
      if (typeof value === 'object' && value !== null) {
        return createWebSafeProxy(value);
      }
      return value;
    },
    set(target, prop, value) {
      if (typeof prop === 'string' && isClinicalField(prop)) {
        throw new PHIBoundaryViolationError(
          prop,
          'Attempted to set clinical field through web-safe proxy'
        );
      }
      return Reflect.set(target, prop, value);
    },
  });
}
