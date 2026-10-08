import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * Shared desktop layout primitives (clinical ops, mouse-first).
 * Gutter rhythm: 1rem (p-4) everywhere. Form pages use PageBody narrow.
 * Do not invent per-screen max-w / px stacks.
 */

const GUTTER = "px-4";
const BODY_PAD = "p-4";

type Narrow = boolean | "md" | "lg" | "xl";

function narrowClass(narrow?: Narrow): string | null {
  if (!narrow) return null;
  if (narrow === true || narrow === "md") return "max-w-2xl";
  if (narrow === "lg") return "max-w-3xl";
  return "max-w-4xl";
}

interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  /** Constrain the whole page (header + body). Prefer PageBody narrow for forms. */
  narrow?: Narrow;
}

export function PageShell({
  className,
  narrow,
  children,
  ...props
}: PageShellProps) {
  const width = narrowClass(narrow);

  return (
    <div
      className={cn("h-full flex flex-col bg-background", className)}
      {...props}
    >
      {width ? (
        <div className="flex-1 overflow-y-auto">
          <div className={cn("mx-auto w-full space-y-6", BODY_PAD, width)}>
            {children}
          </div>
        </div>
      ) : (
        children
      )}
    </div>
  );
}

interface PageHeaderProps
  extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  /** Back control or eyebrow above the title. */
  leading?: ReactNode;
  actions?: ReactNode;
  sticky?: boolean;
}

export function PageHeader({
  title,
  description,
  leading,
  actions,
  sticky = false,
  className,
  children,
  ...props
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        GUTTER,
        "py-4 border-b border-border bg-background space-y-3 shrink-0",
        sticky && "sticky top-0 z-10",
        className
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex items-start gap-3">
          {leading ? <div className="shrink-0 pt-0.5">{leading}</div> : null}
          <div className="min-w-0 space-y-1">
            <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
            {description ? (
              <div className="text-sm text-muted-foreground">{description}</div>
            ) : null}
          </div>
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
            {actions}
          </div>
        ) : null}
      </div>
      {children}
    </header>
  );
}

interface PageSectionProps
  extends Omit<HTMLAttributes<HTMLElement>, "title"> {
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
}

export function PageSection({
  title,
  description,
  actions,
  className,
  children,
  ...props
}: PageSectionProps) {
  return (
    <section className={cn("space-y-3", className)} {...props}>
      {(title || actions) && (
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 space-y-1">
            {title ? (
              <h2 className="text-lg font-medium tracking-tight">{title}</h2>
            ) : null}
            {description ? (
              <div className="text-sm text-muted-foreground">{description}</div>
            ) : null}
          </div>
          {actions ? (
            <div className="flex shrink-0 flex-wrap gap-2">{actions}</div>
          ) : null}
        </div>
      )}
      {!title && description ? (
        <div className="text-sm text-muted-foreground">{description}</div>
      ) : null}
      {children}
    </section>
  );
}

/** Horizontal (desktop) or wrapping action cluster. */
export function ActionRow({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex flex-wrap items-center gap-2", className)}
      {...props}
    >
      {children}
    </div>
  );
}

interface PageBodyProps extends HTMLAttributes<HTMLDivElement> {
  /** Centered content column for forms / help / settings. */
  narrow?: Narrow;
}

/** Full-bleed scroll body under a PageHeader. Always p-4 gutters. */
export function PageBody({
  className,
  narrow,
  children,
  ...props
}: PageBodyProps) {
  const width = narrowClass(narrow);

  return (
    <div
      className={cn("flex-1 overflow-y-auto", BODY_PAD, className)}
      {...props}
    >
      {width ? (
        <div className={cn("mx-auto w-full space-y-6", width)}>{children}</div>
      ) : (
        children
      )}
    </div>
  );
}

/** Footer strip under list views. */
export function PageFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        GUTTER,
        "py-3 border-t border-border bg-muted/50 text-xs text-muted-foreground shrink-0",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
