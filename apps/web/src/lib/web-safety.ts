/**
 * Web Safety Middleware
 *
 * This module ensures that clinical data NEVER appears in web responses.
 * Import and use assertWebSafePayload before sending ANY data to clients.
 */

import { assertWebSafePayload, PHIBoundaryViolationError } from '@solopractice/shared';

export { assertWebSafePayload, PHIBoundaryViolationError };

/**
 * Wrap an API response to ensure it's web-safe.
 * Use this in all API routes before returning data.
 */
export function safeJsonResponse<T>(data: T, init?: ResponseInit): Response {
  // Validate the payload before sending
  assertWebSafePayload(data, 'API response');

  return new Response(JSON.stringify(data), {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...init?.headers,
    },
  });
}

/**
 * Create a safe API response with standard envelope.
 */
export function apiResponse<T>(data: T, init?: ResponseInit): Response {
  const envelope = {
    success: true,
    data,
    timestamp: new Date().toISOString(),
  };

  return safeJsonResponse(envelope, init);
}

/**
 * Create an error response.
 */
export function errorResponse(
  code: string,
  message: string,
  status: number = 400
): Response {
  const envelope = {
    success: false,
    error: { code, message },
    timestamp: new Date().toISOString(),
  };

  return safeJsonResponse(envelope, { status });
}
