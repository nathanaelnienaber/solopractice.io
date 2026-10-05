"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import { LanguageToggle } from "@/components/LanguageToggle";
import { Button } from "@/components/ui/button";
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
  const router = useRouter();
  const { t } = useI18n();

  async function handleSignOut() {
    await fetch("/api/auth/logout", {
      method: "POST",
      headers: { Accept: "application/json" },
    });
    router.push("/therapist/login");
    router.refresh();
  }

  return (
    <header className="border-b border-border">
      <div className="max-w-6xl mx-auto px-4 py-4 flex items-center justify-between gap-4">
        <div>
          <Link
            href="/therapist/dashboard"
            className="text-xl font-semibold hover:text-primary"
          >
            SoloPractice
          </Link>
          {subtitle ? (
            <p className="text-sm text-muted-foreground">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-4 flex-wrap justify-end">
          <nav className="flex items-center gap-4 flex-wrap" aria-label="Therapist">
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
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleSignOut}
          >
            {t("nav.signOut")}
          </Button>
        </div>
      </div>
    </header>
  );
}
