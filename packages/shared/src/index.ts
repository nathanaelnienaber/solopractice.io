/**
 * @solopractice/shared
 *
 * Shared types and PHI boundary enforcement.
 *
 * HARD RULE: Clinical data (SOAP, Dx, CPT, audio, transcripts) NEVER leaves desktop.
 * This package defines the boundary types and provides runtime guards.
 */

export * from './types/client';
export * from './types/consent';
export * from './types/session';
export * from './types/invoice';
export * from './types/clinical';
export * from './types/web-safe';
export * from './guards/web-safety';
