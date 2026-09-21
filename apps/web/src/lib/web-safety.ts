/**
 * Web Safety Middleware
 *
 * Validates that incoming API requests do not contain clinical data.
 * This is a defense-in-depth measure - the schema already excludes these fields.
 */

import { NextRequest, NextResponse } from "next/server";
import {
  assertWebSafePayload,
  WebSafetyViolationError,
} from "@solopractice/shared/web";

export async function validateWebSafeRequest(
  request: NextRequest
): Promise<{ valid: true; body: unknown } | { valid: false; error: string }> {
  try {
    const body = await request.json();
    assertWebSafePayload(body);
    return { valid: true, body };
  } catch (error) {
    if (error instanceof WebSafetyViolationError) {
      console.error(
        `[SECURITY] Web safety violation from ${request.ip}: ${error.blockedFields.join(", ")}`
      );
      return {
        valid: false,
        error: `Request rejected: contains prohibited clinical fields (${error.blockedFields.join(", ")}). Clinical data must remain on the desktop application.`,
      };
    }
    if (error instanceof SyntaxError) {
      return { valid: false, error: "Invalid JSON body" };
    }
    throw error;
  }
}

export function webSafetyErrorResponse(errorMessage: string) {
  return NextResponse.json(
    {
      error: errorMessage,
      code: "CLINICAL_DATA_REJECTED",
      help: "Clinical data (SOAP notes, diagnoses, procedures, recordings, transcripts) must remain on the desktop application and cannot be synced to the web.",
    },
    { status: 400 }
  );
}
