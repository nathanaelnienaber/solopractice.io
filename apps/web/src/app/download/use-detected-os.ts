"use client";

import { useEffect, useState } from "react";
import type { DesktopOs } from "./download-urls";

/**
 * Best-effort client-side OS detection so we can highlight the right
 * download button first. Falls back gracefully to "mac" (alphabetically
 * first / most common for our current trial users) if detection is
 * inconclusive — the other two OS options stay visible either way, so a
 * wrong guess just means an extra click, never a dead end.
 */
export function useDetectedOs(): DesktopOs | null {
  const [os, setOs] = useState<DesktopOs | null>(null);

  useEffect(() => {
    setOs(detectOs());
  }, []);

  return os;
}

function osFromString(s: string): DesktopOs | null {
  const v = s.toLowerCase();
  if (v.includes("win")) return "windows";
  if (v.includes("linux") && !v.includes("android")) return "linux";
  if (v.includes("mac") || v.includes("iphone") || v.includes("ipad")) return "mac";
  return null;
}

function detectOs(): DesktopOs {
  if (typeof navigator === "undefined") return "mac";

  // Prefer the modern userAgentData.platform API when present — it's the
  // more authoritative signal in Chromium-based browsers and isn't subject
  // to legacy UA-string quirks/spoofing via compatibility tokens.
  const uaData = (navigator as unknown as { userAgentData?: { platform?: string } })
    .userAgentData;
  const fromPlatformApi = uaData?.platform ? osFromString(uaData.platform) : null;
  if (fromPlatformApi) return fromPlatformApi;

  // Fall back to navigator.platform (older but still broadly supported),
  // then finally the full UA string.
  const fromPlatform = navigator.platform ? osFromString(navigator.platform) : null;
  if (fromPlatform) return fromPlatform;

  const fromUa = navigator.userAgent ? osFromString(navigator.userAgent) : null;
  if (fromUa) return fromUa;

  return "mac";
}
