"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/therapist/dashboard", key: "nav.dashboard" },
  { href: "/therapist/calendar", key: "nav.calendar" },
  { href: "/therapist/clients", key: "nav.clients" },
  { href: "/therapist/invoices", key: "nav.invoices" },
  { href: "/therapist/settings", key: "nav.settings" },
] as const;

export function TherapistNav({ subtitle }: { subtitle?: string }) {
  const pathname = usePathname();
  const { t } = useI18n();

  return (
    <header className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold">SoloPractice</h1>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-end">
          <nav className="flex items-center gap-4 flex-wrap">
            {links.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  "text-sm hover:text-primary",
                  pathname === href || pathname.startsWith(`${href}/`)
                    ? "text-primary font-medium"
                    : "text-muted-foreground"
                )}
              >
                {t(key)}
              </Link>
            ))}
          </nav>
          <LanguageToggle />
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
