import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { THEME_STORAGE_KEY, themeInitScript } from "./theme-boot";

describe("theme boot", () => {
  it("uses a stable localStorage key", () => {
    expect(THEME_STORAGE_KEY).toBe("solopractice-theme");
  });

  it("boot script toggles the dark class from stored preference", () => {
    expect(themeInitScript).toContain(THEME_STORAGE_KEY);
    expect(themeInitScript).toContain('classList.toggle("dark"');
    expect(themeInitScript).toContain("prefers-color-scheme: dark");
  });
});

describe("globals.css dark theme", () => {
  const css = readFileSync(
    join(__dirname, "../app/globals.css"),
    "utf8",
  );

  it("uses class-based dark variables, not prefers-color-scheme alone", () => {
    expect(css).toContain("@custom-variant dark");
    expect(css).toMatch(/\.dark\s*\{/);
    expect(css).not.toMatch(
      /@media\s*\(\s*prefers-color-scheme:\s*dark\s*\)\s*\{\s*:root/,
    );
  });
});
