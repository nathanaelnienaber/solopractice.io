/**
 * Desktop installer download URLs.
 *
 * These point at GitHub Releases artifacts produced by the desktop build
 * pipeline (apps/desktop, packaged with Tauri, built via
 * .github/workflows/desktop-release.yml). Verified live Oct 9 2026: repo is
 * public, all three primary URLs return real anonymous HTTP 200s with correct
 * file sizes (no login wall). `releases/latest/download/<name>` tracks whatever
 * release is marked "latest" on GitHub; filenames still embed DESKTOP_VERSION
 * (Tauri derives them from the app name/version/arch in tauri.conf.json), so
 * bump DESKTOP_VERSION when cutting a release.
 *
 * Mac build is Apple Silicon (aarch64) only — no Intel x86_64 .dmg exists
 * yet. Confirmed fine for the current trial user (Apple Silicon Mac).
 */
export const DESKTOP_VERSION = "0.1.8";

const RELEASE_ASSET = (name: string) =>
  `https://github.com/nathanaelnienaber/solopractice.io/releases/latest/download/${name}`;

export const DOWNLOAD_URLS = {
  mac: RELEASE_ASSET(`SoloPractice_${DESKTOP_VERSION}_aarch64.dmg`),
  windows: RELEASE_ASSET(`SoloPractice_${DESKTOP_VERSION}_x64-setup.exe`),
  linux: RELEASE_ASSET(`SoloPractice_${DESKTOP_VERSION}_amd64.AppImage`),
} as const;

/** Optional secondary installers linked from docs (not featured on /download). */
export const DOWNLOAD_URLS_OPTIONAL = {
  linuxDeb: RELEASE_ASSET(`SoloPractice_${DESKTOP_VERSION}_amd64.deb`),
  windowsMsi: RELEASE_ASSET(`SoloPractice_${DESKTOP_VERSION}_x64_en-US.msi`),
} as const;

// Real published assets are live — placeholder notice no longer shown.
export const DOWNLOAD_URLS_ARE_PLACEHOLDERS = false;

export type DesktopOs = "mac" | "windows" | "linux";
