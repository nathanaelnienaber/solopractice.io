"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useState } from "react";
import { Menu, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const links = [
  { href: "/therapist/dashboard", key: "nav.dashboard" },
  { href: "/therapist/calendar", key: "nav.calendar" },
  { href: "/therapist/clients", key: "nav.clients" },
  { href: "/therapist/invoices", key: "nav.invoices" },
  { href: "/therapist/settings", key: "nav.settings" },
] as const;

function linkClassName(pathname: string, href: string, mobile = false) {
  const active =
    pathname === href || pathname.startsWith(`${href}/`)
      ? "text-primary font-medium"
      : "text-muted-foreground";

  return cn(
    "text-sm hover:text-primary",
    mobile && "block rounded-lg px-3 py-2 hover:bg-accent",
    active
  );
}

export function TherapistNav({ subtitle }: { subtitle?: string }) {
  const pathname = usePathname();
  const router = useRouter();
  const { t } = useI18n();
  const [menuOpen, setMenuOpen] = useState(false);
  const mobileNavId = useId();

  useEffect(() => {
    setMenuOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) return;

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setMenuOpen(false);
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [menuOpen]);

  async function handleSignOut() {
    setMenuOpen(false);
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
        <div className="min-w-0">
          <Link
            href="/therapist/dashboard"
            className="text-xl font-semibold hover:text-primary"
          >
            SoloPractice
          </Link>
          {subtitle ? (
            <p className="text-sm text-muted-foreground truncate">{subtitle}</p>
          ) : null}
        </div>
        <div className="flex items-center gap-2 sm:gap-4 justify-end shrink-0">
          <nav
            className="hidden md:flex items-center gap-4"
            aria-label={t("nav.menu")}
          >
            {links.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                className={linkClassName(pathname, href)}
              >
                {t(key)}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
          {/* Button bakes in inline-flex, so hide via wrapper — not className */}
          <div className="hidden md:block">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSignOut}
            >
              {t("nav.signOut")}
            </Button>
          </div>
          <button
            type="button"
            className="md:hidden flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-muted p-2 text-muted-foreground transition-colors hover:text-foreground"
            aria-expanded={menuOpen}
            aria-controls={mobileNavId}
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X className="w-5 h-5" aria-hidden />
            ) : (
              <Menu className="w-5 h-5" aria-hidden />
            )}
          </button>
        </div>
      </div>
      {menuOpen ? (
        <div
          id={mobileNavId}
          className="md:hidden border-t border-border bg-background"
        >
          <nav
            className="max-w-6xl mx-auto px-4 py-3 flex flex-col gap-1"
            aria-label={t("nav.menu")}
          >
            {links.map(({ href, key }) => (
              <Link
                key={href}
                href={href}
                className={cn(linkClassName(pathname, href, true), "min-h-11")}
                onClick={() => setMenuOpen(false)}
              >
                {t(key)}
              </Link>
            ))}
            <Button
              type="button"
              variant="ghost"
              className="min-h-11 justify-start px-3"
              onClick={handleSignOut}
            >
              {t("nav.signOut")}
            </Button>
          </nav>
        </div>
      ) : null}
    </header>
  );
}
