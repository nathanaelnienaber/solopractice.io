/**
 * Microphone acquisition for SoloPractice desktop.
 *
 * Chrome / WebView2 accept rich MediaTrackConstraints (mono 16 kHz + AEC/NS).
 * WebKitGTK (Tauri on Linux) often rejects those with "Invalid constraint" or
 * OverconstrainedError — and Setup Wizard previously treated every failure as
 * a soft permission denial, which hid the real cause.
 *
 * Ladder: preferred → soft (AEC/NS only) → `{ audio: true }`.
 * On Linux WebKit, start with the unconstrained path (Linux-safe default).
 */

const PREFERRED_AUDIO: MediaTrackConstraints = {
  channelCount: { ideal: 1 },
  sampleRate: { ideal: 16000 },
  echoCancellation: true,
  noiseSuppression: true,
};

const SOFT_AUDIO: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
};

export type MicFailureKind =
  | "permission"
  | "not_found"
  | "constraint"
  | "unavailable"
  | "unknown";

export function isLinuxWebKit(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent;
  // Tauri Linux uses WebKitGTK; UA looks like Safari/WebKit without Chrome.
  return /Linux/i.test(ua) && /WebKit/i.test(ua) && !/Chrome|Chromium|Edg\//i.test(ua);
}

export function isConstraintFailure(err: unknown): boolean {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: unknown }).name)
      : "";
  const message = err instanceof Error ? err.message : String(err);
  const msg = message.toLowerCase();
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return true;
  }
  // WebKitGTK often uses a generic DOMException / TypeError with this text.
  return msg.includes("invalid constraint") || msg.includes("overconstrained");
}

/** Classify getUserMedia failures so UI does not pretend every miss is privacy settings. */
export function classifyMicFailure(err: unknown): MicFailureKind {
  const name =
    err && typeof err === "object" && "name" in err
      ? String((err as { name: unknown }).name)
      : "";
  if (name === "NotAllowedError" || name === "SecurityError" || name === "PermissionDeniedError") {
    return "permission";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError") {
    return "not_found";
  }
  if (isConstraintFailure(err)) {
    return "constraint";
  }
  if (name === "NotReadableError" || name === "AbortError" || name === "TrackStartError") {
    return "unavailable";
  }
  const message = (err instanceof Error ? err.message : String(err)).toLowerCase();
  if (message.includes("permission") || message.includes("not allowed")) {
    return "permission";
  }
  if (message.includes("not found") || message.includes("no device")) {
    return "not_found";
  }
  return "unknown";
}

export function micFailureUserMessage(kind: MicFailureKind, err: unknown): string {
  const detail = err instanceof Error ? err.message : String(err);
  switch (kind) {
    case "permission":
      return "Microphone access was denied. Allow the microphone in your computer's privacy settings, then try again.";
    case "not_found":
      return "No microphone was found. Plug one in (or check PipeWire/PulseAudio), then try again.";
    case "constraint":
      return `Microphone rejected the requested audio settings (${detail}). SoloPractice will retry with simpler settings automatically; if this keeps happening, update to the latest desktop build.`;
    case "unavailable":
      return "The microphone is busy or unavailable. Close other apps using it, then try again.";
    default:
      return `We couldn't access your microphone (${detail}). You can still type session notes without recording.`;
  }
}

/** Constraint ladder: preferred → soft → unconstrained `{ audio: true }`. */
export function audioConstraintAttempts(): MediaStreamConstraints[] {
  const preferred: MediaStreamConstraints = { audio: PREFERRED_AUDIO };
  const soft: MediaStreamConstraints = { audio: SOFT_AUDIO };
  const any: MediaStreamConstraints = { audio: true };

  // Linux WebKit: unconstrained first (Setup mic test path). Still try richer
  // constraints afterward only if unconstrained somehow fails (unlikely).
  if (isLinuxWebKit()) {
    return [any, soft, preferred];
  }
  return [preferred, soft, any];
}

export async function acquireAudioStream(): Promise<MediaStream> {
  if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
    throw new DOMException(
      "Microphone APIs are unavailable in this window.",
      "NotSupportedError"
    );
  }

  const attempts = audioConstraintAttempts();
  let lastError: unknown;

  for (let i = 0; i < attempts.length; i++) {
    const constraints = attempts[i];
    try {
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      if (i > 0) {
        console.warn(
          "[AudioCapture] getUserMedia succeeded after falling back to constraints:",
          constraints
        );
      }
      return stream;
    } catch (err) {
      lastError = err;
      if (!isConstraintFailure(err) || i === attempts.length - 1) {
        throw err;
      }
      console.warn("[AudioCapture] getUserMedia constraints rejected, trying fallback:", err);
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Failed to acquire microphone");
}
