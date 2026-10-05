"use client";

import { Moon, Sun, Monitor } from "lucide-react";
import { useTheme } from "@/lib/theme";

const THEME_CYCLE = ["light", "dark", "system"] as const;

const THEME_LABELS = {
  light: "Light",
  dark: "Dark",
  system: "System",
} as const;

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();

  const currentIndex = THEME_CYCLE.indexOf(theme);
  const nextTheme =
    THEME_CYCLE[(currentIndex + 1) % THEME_CYCLE.length] ?? "light";

  const Icon = theme === "dark" ? Moon : theme === "system" ? Monitor : Sun;
  const ariaLabel = `${THEME_LABELS[theme]} mode. Switch to ${THEME_LABELS[nextTheme].toLowerCase()} mode`;

  return (
    <button
      type="button"
      onClick={() => setTheme(nextTheme)}
      className="p-2 rounded-lg bg-muted text-muted-foreground hover:text-foreground transition-colors"
      title={ariaLabel}
      aria-label={ariaLabel}
    >
      <Icon className="w-4 h-4" />
    </button>
  );
}
