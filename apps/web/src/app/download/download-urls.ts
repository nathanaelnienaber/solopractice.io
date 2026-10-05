/**
 * Desktop installer download URLs.
 *
 * These point at GitHub Releases artifacts produced by the desktop build
 * pipeline (apps/desktop, packaged with Tauri, built via
 * .github/workflows/desktop-release.yml). Verified live Oct 2 2026: repo is
 * public, all three URLs return real anonymous HTTP 200s with correct file
 * sizes (no login wall). `releases/latest/download/<name>` tracks whatever
 * release is marked "latest" on GitHub, so this does not need to be edited
 * again for future releases as long as the asset file names stay the same
 * (Tauri derives them from the app name/version/arch in tauri.conf.json).
 *
 * Mac build is Apple Silicon (aarch64) only — no Intel x86_64 .dmg exists
 * yet. Confirmed fine for the current trial user (Apple Silicon Mac).
 */
export const DOWNLOAD_URLS = {
  mac: "https://github.com/nathanaelnienaber/solopractice.io/releases/latest/download/SoloPractice_0.1.1_aarch64.dmg",
  windows:
    "https://github.com/nathanaelnienaber/solopractice.io/releases/latest/download/SoloPractice_0.1.1_x64-setup.exe",
  linux:
    "https://github.com/nathanaelnienaber/solopractice.io/releases/latest/download/SoloPractice_0.1.1_amd64.AppImage",
} as const;

// Real published assets are live — placeholder notice no longer shown.
export const DOWNLOAD_URLS_ARE_PLACEHOLDERS = false;

export type DesktopOs = "mac" | "windows" | "linux";
