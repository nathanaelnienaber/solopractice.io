"use client";

import { Check } from "lucide-react";
import { useI18n, LANGUAGES, type Language } from "@/lib/i18n";
import { cn } from "@/lib/utils";

/** Settings-friendly language picker (list, not nav dropdown). */
export function LanguagePanel() {
  const { language, setLanguage } = useI18n();

  return (
    <ul className="divide-y divide-border rounded-lg border border-border">
      {LANGUAGES.map((lang) => {
        const selected = language === lang.code;
        return (
          <li key={lang.code}>
            <button
              type="button"
              onClick={() => setLanguage(lang.code as Language)}
              className={cn(
                "flex w-full items-center gap-3 px-4 py-3 text-left text-sm transition-colors hover:bg-muted",
                selected && "bg-muted/60 text-primary"
              )}
              aria-pressed={selected}
              aria-label={lang.name}
            >
              <span className="text-lg" aria-hidden>
                {lang.flag}
              </span>
              <span className="flex-1 font-medium">{lang.name}</span>
              {selected ? (
                <Check className="h-4 w-4 text-primary" aria-hidden />
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
