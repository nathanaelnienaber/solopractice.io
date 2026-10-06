"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useState, type ReactNode } from "react";
import { Menu, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import { ThemeToggle } from "@/components/ThemeToggle";
import { cn } from "@/lib/utils";

const links = [
  { href: "/", key: "nav.home", match: "exact" as const },
  { href: "/download", key: "nav.download", match: "prefix" as const },
  { href: "/therapist/login", key: "nav.signIn", match: "prefix" as const },
] as const;

function linkIsActive(pathname: string, href: string, match: "exact" | "prefix") {
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

function linkClassName(
  pathname: string,
  href: string,
  match: "exact" | "prefix",
  mobile = false
) {
  const active = linkIsActive(pathname, href, match)
    ? "text-primary font-medium"
    : "text-muted-foreground";

  return cn(
    "text-sm hover:text-primary",
    mobile && "block rounded-lg px-3 py-2 hover:bg-accent",
    active
  );
}

/** Shared top chrome for public marketing pages (home, download, login, offline). */
export function PublicNav() {
  const pathname = usePathname();
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

  return (
    <header className="border-b border-border">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4">
        <div className="min-w-0">
          <Link href="/" className="text-xl font-semibold hover:text-primary">
            SoloPractice
          </Link>
        </div>
        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-4">
          <nav
            className="hidden items-center gap-4 md:flex"
            aria-label={t("nav.menu")}
          >
            {links.map(({ href, key, match }) => (
              <Link
                key={href}
                href={href}
                className={linkClassName(pathname, href, match)}
              >
                {t(key)}
              </Link>
            ))}
          </nav>
          <ThemeToggle />
          <button
            type="button"
            className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-muted p-2 text-muted-foreground transition-colors hover:text-foreground md:hidden"
            aria-expanded={menuOpen}
            aria-controls={mobileNavId}
            aria-label={menuOpen ? t("nav.closeMenu") : t("nav.openMenu")}
            onClick={() => setMenuOpen((open) => !open)}
          >
            {menuOpen ? (
              <X className="h-5 w-5" aria-hidden />
            ) : (
              <Menu className="h-5 w-5" aria-hidden />
            )}
          </button>
        </div>
      </div>
      {menuOpen ? (
        <div
          id={mobileNavId}
          className="border-t border-border bg-background md:hidden"
        >
          <nav
            className="mx-auto flex max-w-6xl flex-col gap-1 px-4 py-3"
            aria-label={t("nav.menu")}
          >
            {links.map(({ href, key, match }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  linkClassName(pathname, href, match, true),
                  "min-h-11"
                )}
                onClick={() => setMenuOpen(false)}
              >
                {t(key)}
              </Link>
            ))}
          </nav>
        </div>
      ) : null}
    </header>
  );
}

/** Public marketing pages: shared nav + full-height column for PageShell / CenteredShell. */
export function PublicChrome({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <PublicNav />
      {children}
    </div>
  );
}
