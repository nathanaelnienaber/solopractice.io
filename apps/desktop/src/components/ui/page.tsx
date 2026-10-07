import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * Shared desktop layout primitives (clinical ops, mouse-first).
 * Prefer these over one-off header / padding / empty-state patterns.
 */

interface PageShellProps extends HTMLAttributes<HTMLDivElement> {
  /** Constrain content width (forms). Default: full scroll area. */
  narrow?: boolean | "md" | "lg";
}

export function PageShell({
  className,
  narrow,
  children,
  ...props
}: PageShellProps) {
  const width =
    narrow === true || narrow === "md"
      ? "max-w-2xl"
      : narrow === "lg"
        ? "max-w-3xl"
        : null;

  return (
    <div className={cn("h-full flex flex-col", className)} {...props}>
      {width ? (
        <div className={cn("flex-1 overflow-y-auto")}>
          <div className={cn("mx-auto w-full p-4 space-y-6", width)}>
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
        "px-4 py-4 border-b border-border bg-background space-y-3",
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

/** Full-bleed scroll body under a PageHeader. */
export function PageBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("flex-1 overflow-y-auto p-4", className)}
      {...props}
    >
      {children}
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
        "px-4 py-3 border-t border-border bg-muted/50 text-xs text-muted-foreground",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
