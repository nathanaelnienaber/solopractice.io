/**
 * Documented web → desktop handoff scheme.
 *
 * The Tauri app does not yet register an OS deep-link handler. Web UI may
 * attempt these URLs; until the desktop plugin lands, the OS will typically
 * no-op and the UI must show a pragmatic fallback (download + copy client id).
 *
 * Reserved paths:
 * - solopractice://client/<clientId>          → select client / start session
 * - solopractice://client/<clientId>/session → open session / SOAP for client
 */
export const DESKTOP_URL_SCHEME = "solopractice";

export function desktopClientDeepLink(
  clientId: string,
  path: "client" | "session" = "client"
): string {
  if (path === "session") {
    return `${DESKTOP_URL_SCHEME}://client/${encodeURIComponent(clientId)}/session`;
  }
  return `${DESKTOP_URL_SCHEME}://client/${encodeURIComponent(clientId)}`;
}

export function tryOpenDesktopDeepLink(url: string): void {
  // Custom-scheme navigation is the standard handoff attempt. Browsers that
  // cannot resolve the scheme leave the page as-is; callers should still show
  // fallback copy/download instructions.
  window.location.assign(url);
}
