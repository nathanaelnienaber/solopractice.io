/**
 * Web Safety Tests — PHI Boundary Enforcement
 *
 * These tests verify that clinical data CANNOT be serialized to web payloads.
 * If these tests fail, the PHI boundary has been compromised.
 *
 * CRITICAL: These tests MUST pass before any release.
 */

import { describe, it, expect } from 'vitest';
import {
  assertWebSafePayload,
  findClinicalFields,
  isClinicalField,
  isWebSafe,
  stripClinicalFields,
  PHIBoundaryViolationError,
  createWebSafeProxy,
} from './web-safety';
import type { DesktopClient, WebSafeClient, ConsentStatusFlags } from '../types/client';
import type { DesktopSession, WebSafeAppointment, SOAPNote } from '../types/session';
import type { DesktopSuperbill, WebInvoice } from '../types/invoice';

describe('PHI Boundary - Clinical Field Detection', () => {
  it('should identify all clinical field names', () => {
    const clinicalFields = [
      'transcript',
      'soapNote',
      'soapDraft',
      'diagnosisCodes',
      'cptCodes',
      'privateNotes',
      'audioFilePath',
      'lineItems',
      'subjective',
      'objective',
      'assessment',
      'plan',
    ];

    for (const field of clinicalFields) {
      expect(isClinicalField(field)).toBe(true);
    }
  });

  it('should NOT flag web-safe field names as clinical', () => {
    const webSafeFields = [
      'id',
      'firstName',
      'lastName',
      'email',
      'phone',
      'createdAt',
      'updatedAt',
      'amountCents',
      'scheduledAt',
      'status',
    ];

    for (const field of webSafeFields) {
      expect(isClinicalField(field)).toBe(false);
    }
  });
});

describe('PHI Boundary - assertWebSafePayload', () => {
  it('should ALLOW web-safe client data', () => {
    const webSafeClient: WebSafeClient = {
      id: 'client_123',
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      phone: '555-0123',
      consentStatus: {
        informedConsent: true,
        privacyNotice: true,
        telehealth: false,
        recordingConsent: true,
        limitsOfConfidentiality: true,
        lastUpdated: '2026-09-18T10:00:00Z',
      },
      createdAt: '2026-09-18T10:00:00Z',
      updatedAt: '2026-09-18T10:00:00Z',
    };

    expect(() => assertWebSafePayload(webSafeClient)).not.toThrow();
  });

  it('should REJECT desktop client with clinical fields', () => {
    const desktopClient: DesktopClient = {
      id: 'client_123',
      localId: 1,
      firstName: 'Jane',
      lastName: 'Doe',
      email: 'jane@example.com',
      consentStatus: {
        informedConsent: true,
        privacyNotice: true,
        telehealth: false,
        recordingConsent: true,
        limitsOfConfidentiality: true,
        lastUpdated: '2026-09-18T10:00:00Z',
      },
      createdAt: '2026-09-18T10:00:00Z',
      updatedAt: '2026-09-18T10:00:00Z',
      sessionIds: [1, 2, 3],
      recordingEnabled: true,
      diagnosisCodes: ['F32.1', 'F41.1'], // CLINICAL — MUST FAIL
    };

    expect(() => assertWebSafePayload(desktopClient)).toThrow(PHIBoundaryViolationError);
    expect(() => assertWebSafePayload(desktopClient)).toThrow(/diagnosisCodes/);
  });

  it('should REJECT session with transcript', () => {
    const session = {
      id: 'session_123',
      clientId: 'client_123',
      scheduledAt: '2026-09-18T14:00:00Z',
      transcript: 'Patient discussed feelings of anxiety...', // CLINICAL — MUST FAIL
    };

    expect(() => assertWebSafePayload(session)).toThrow(PHIBoundaryViolationError);
    expect(() => assertWebSafePayload(session)).toThrow(/transcript/);
  });

  it('should REJECT session with SOAP note', () => {
    const soapNote: SOAPNote = {
      subjective: 'Patient reports feeling anxious',
      objective: 'Patient appeared restless',
      assessment: 'Generalized anxiety disorder',
      plan: 'Continue CBT, review in 2 weeks',
      finalized: true,
    };

    const session = {
      id: 'session_123',
      soapNote, // CLINICAL — MUST FAIL
    };

    expect(() => assertWebSafePayload(session)).toThrow(PHIBoundaryViolationError);
    expect(() => assertWebSafePayload(session)).toThrow(/soapNote/);
  });

  it('should REJECT any object with CPT codes', () => {
    const payload = {
      id: 'invoice_123',
      amountCents: 15000,
      cptCodes: ['90834', '90837'], // CLINICAL — MUST FAIL
    };

    expect(() => assertWebSafePayload(payload)).toThrow(PHIBoundaryViolationError);
    expect(() => assertWebSafePayload(payload)).toThrow(/cptCodes/);
  });

  it('should REJECT nested clinical data', () => {
    const payload = {
      wrapper: {
        data: {
          nested: {
            privateNotes: 'Clinical observation...', // CLINICAL — MUST FAIL
          },
        },
      },
    };

    expect(() => assertWebSafePayload(payload)).toThrow(PHIBoundaryViolationError);
    expect(() => assertWebSafePayload(payload)).toThrow(/privateNotes/);
  });

  it('should REJECT clinical data in arrays', () => {
    const payload = {
      sessions: [
        { id: '1', scheduledAt: '2026-09-18T10:00:00Z' },
        { id: '2', transcript: 'Clinical content...' }, // CLINICAL — MUST FAIL
      ],
    };

    expect(() => assertWebSafePayload(payload)).toThrow(PHIBoundaryViolationError);
    expect(() => assertWebSafePayload(payload)).toThrow(/transcript/);
  });

  it('should REJECT superbill line items (contain CPT)', () => {
    const superbill = {
      id: 'sb_123',
      lineItems: [
        // CLINICAL — MUST FAIL
        { cptCode: '90834', description: 'Psychotherapy, 45 min', feeCents: 15000 },
      ],
    };

    expect(() => assertWebSafePayload(superbill)).toThrow(PHIBoundaryViolationError);
    expect(() => assertWebSafePayload(superbill)).toThrow(/lineItems/);
  });

  it('should REJECT audio file paths', () => {
    const session = {
      id: 'session_123',
      audioFilePath: 'C:\\Users\\therapist\\recordings\\session_123.wav', // CLINICAL — MUST FAIL
    };

    expect(() => assertWebSafePayload(session)).toThrow(PHIBoundaryViolationError);
    expect(() => assertWebSafePayload(session)).toThrow(/audioFilePath/);
  });

  it('should ALLOW web-safe invoice', () => {
    const invoice: WebInvoice = {
      id: 'inv_123',
      clientId: 'client_123',
      sessionRef: 'session_123',
      amountCents: 15000,
      currency: 'usd',
      description: 'Individual therapy session - 45 minutes',
      dueDate: '2026-09-25T00:00:00Z',
      status: 'sent',
      platformFeeCents: 150,
      stripeFeeCents: 465,
      createdAt: '2026-09-18T10:00:00Z',
      updatedAt: '2026-09-18T10:00:00Z',
    };

    expect(() => assertWebSafePayload(invoice)).not.toThrow();
  });

  it('should ALLOW web-safe appointment', () => {
    const appointment: WebSafeAppointment = {
      id: 'apt_123',
      clientId: 'client_123',
      scheduledAt: '2026-09-18T14:00:00Z',
      durationMinutes: 45,
      sessionType: 'individual',
      status: 'scheduled',
      createdAt: '2026-09-18T10:00:00Z',
      updatedAt: '2026-09-18T10:00:00Z',
    };

    expect(() => assertWebSafePayload(appointment)).not.toThrow();
  });
});

describe('PHI Boundary - findClinicalFields', () => {
  it('should return null for web-safe payloads', () => {
    const webSafe = {
      id: 'client_123',
      firstName: 'Jane',
      email: 'jane@example.com',
    };

    expect(findClinicalFields(webSafe)).toBeNull();
  });

  it('should return field info for clinical payloads', () => {
    const clinical = {
      id: 'session_123',
      transcript: 'Clinical content...',
    };

    const result = findClinicalFields(clinical);
    expect(result).not.toBeNull();
    expect(result?.field).toBe('transcript');
    expect(result?.path).toBe('transcript');
  });

  it('should return correct path for nested clinical fields', () => {
    const nested = {
      data: {
        session: {
          soapNote: { subjective: 'test' },
        },
      },
    };

    const result = findClinicalFields(nested);
    expect(result).not.toBeNull();
    expect(result?.field).toBe('soapNote');
    expect(result?.path).toBe('data.session.soapNote');
  });
});

describe('PHI Boundary - stripClinicalFields', () => {
  it('should remove clinical fields from objects', () => {
    const mixed = {
      id: 'session_123',
      clientId: 'client_123',
      scheduledAt: '2026-09-18T14:00:00Z',
      transcript: 'Clinical content that should be removed',
      diagnosisCodes: ['F32.1'],
    };

    const stripped = stripClinicalFields(mixed);

    expect(stripped.id).toBe('session_123');
    expect(stripped.clientId).toBe('client_123');
    expect(stripped.scheduledAt).toBe('2026-09-18T14:00:00Z');
    expect('transcript' in stripped).toBe(false);
    expect('diagnosisCodes' in stripped).toBe(false);
  });

  it('should recursively strip nested clinical fields', () => {
    const nested = {
      session: {
        id: 'session_123',
        soapNote: { subjective: 'test' },
        status: 'completed',
      },
    };

    const stripped = stripClinicalFields(nested);
    const session = stripped.session as Record<string, unknown>;

    expect(session.id).toBe('session_123');
    expect(session.status).toBe('completed');
    expect('soapNote' in session).toBe(false);
  });
});

describe('PHI Boundary - isWebSafe', () => {
  it('should return true for web-safe payloads', () => {
    expect(isWebSafe({ id: 'test', email: 'test@example.com' })).toBe(true);
  });

  it('should return false for clinical payloads', () => {
    expect(isWebSafe({ id: 'test', transcript: 'clinical' })).toBe(false);
    expect(isWebSafe({ id: 'test', diagnosisCodes: [] })).toBe(false);
    expect(isWebSafe({ id: 'test', soapNote: {} })).toBe(false);
  });

  it('should handle null and undefined', () => {
    expect(isWebSafe(null)).toBe(true);
    expect(isWebSafe(undefined)).toBe(true);
  });

  it('should handle primitives', () => {
    expect(isWebSafe('string')).toBe(true);
    expect(isWebSafe(123)).toBe(true);
    expect(isWebSafe(true)).toBe(true);
  });
});

describe('PHI Boundary - createWebSafeProxy', () => {
  it('should allow access to web-safe fields', () => {
    const obj = { id: 'test', email: 'test@example.com' };
    const proxy = createWebSafeProxy(obj);

    expect(proxy.id).toBe('test');
    expect(proxy.email).toBe('test@example.com');
  });

  it('should throw on access to clinical fields', () => {
    const obj = {
      id: 'test',
      transcript: 'clinical content',
    } as Record<string, unknown>;
    const proxy = createWebSafeProxy(obj);

    expect(proxy.id).toBe('test');
    expect(() => proxy.transcript).toThrow(PHIBoundaryViolationError);
  });

  it('should throw on setting clinical fields', () => {
    const obj: Record<string, unknown> = { id: 'test' };
    const proxy = createWebSafeProxy(obj);

    expect(() => {
      proxy.transcript = 'clinical content';
    }).toThrow(PHIBoundaryViolationError);
  });
});

describe('PHI Boundary - Real-world Scenarios', () => {
  it('should REJECT full desktop session serialized to web', () => {
    const desktopSession: DesktopSession = {
      localId: 1,
      webAppointmentId: 'apt_123',
      clientLocalId: 1,
      sessionDate: '2026-09-18T14:00:00Z',
      durationMinutes: 45,
      sessionType: 'individual',
      audioFilePath: 'C:\\recordings\\session_1.wav',
      recordingStatus: 'completed',
      transcript: 'Patient discussed ongoing anxiety symptoms...',
      transcriptStatus: 'completed',
      soapNote: {
        subjective: 'Patient reports increased anxiety',
        objective: 'Patient appeared restless, fidgeting',
        assessment: 'Generalized Anxiety Disorder, improving',
        plan: 'Continue weekly CBT sessions',
        finalized: true,
        finalizedAt: '2026-09-18T15:00:00Z',
      },
      soapStatus: 'finalized',
      diagnosisCodes: ['F41.1'],
      cptCodes: ['90834'],
      privateNotes: 'Consider medication referral if symptoms persist',
      createdAt: '2026-09-18T14:00:00Z',
      updatedAt: '2026-09-18T15:00:00Z',
    };

    // This MUST throw — a full desktop session must never be web-serialized
    expect(() => assertWebSafePayload(desktopSession)).toThrow(PHIBoundaryViolationError);
  });

  it('should REJECT desktop superbill serialized to web', () => {
    const superbill: DesktopSuperbill = {
      localId: 1,
      sessionLocalId: 1,
      clientLocalId: 1,
      serviceDate: '2026-09-18',
      providerName: 'Dr. Smith',
      providerNPI: '1234567890',
      providerLicense: 'LMHC12345',
      clientName: 'Jane Doe',
      clientDOB: '1990-01-15',
      lineItems: [
        { cptCode: '90834', description: 'Psychotherapy, 45 min', units: 1, feeCents: 15000 },
      ],
      diagnosisCodes: ['F41.1'],
      totalCents: 15000,
      pdfPath: 'C:\\superbills\\sb_1.pdf',
      createdAt: '2026-09-18T15:00:00Z',
    };

    // This MUST throw — superbills contain clinical codes
    expect(() => assertWebSafePayload(superbill)).toThrow(PHIBoundaryViolationError);
  });

  it('should ALLOW consent sync payload to web', () => {
    const consentSync = {
      clients: [
        {
          id: 'client_123',
          consentStatus: {
            informedConsent: true,
            privacyNotice: true,
            telehealth: true,
            recordingConsent: true,
            limitsOfConfidentiality: true,
            lastUpdated: '2026-09-18T10:00:00Z',
          },
        },
      ],
      syncedAt: '2026-09-18T10:00:00Z',
    };

    // Consent status flags are ops data — safe for web
    expect(() => assertWebSafePayload(consentSync)).not.toThrow();
  });

  it('should ALLOW invoice sync payload to web', () => {
    const invoicePayload = {
      invoices: [
        {
          id: 'inv_123',
          clientId: 'client_123',
          amountCents: 15000,
          currency: 'usd',
          description: 'Therapy session - September 18',
          dueDate: '2026-09-25',
          status: 'sent',
          platformFeeCents: 150,
          stripeFeeCents: 465,
        },
      ],
    };

    // Invoice amounts/dates are ops data — safe for web
    expect(() => assertWebSafePayload(invoicePayload)).not.toThrow();
  });
});
