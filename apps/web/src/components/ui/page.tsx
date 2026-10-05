import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * Shared therapist-web layout primitives (phone-first).
 * Prefer these over one-off max-w / flex header patterns on each page.
 */

export function PageShell({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLElement>) {
  return (
    <main
      className={cn("mx-auto max-w-6xl space-y-6 px-4 py-8", className)}
      {...props}
    >
      {children}
    </main>
  );
}

interface PageHeaderProps
  extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  title: ReactNode;
  description?: ReactNode;
  /** Primary CTA(s) — full-width under the title on phones, inline from `sm`. */
  actions?: ReactNode;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
  ...props
}: PageHeaderProps) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4",
        className
      )}
      {...props}
    >
      <div className="min-w-0 space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? (
          <div className="text-sm text-muted-foreground">{description}</div>
        ) : null}
      </div>
      {actions ? (
        <div className="flex w-full flex-col gap-2 sm:w-auto sm:shrink-0 sm:flex-row sm:items-center">
          {actions}
        </div>
      ) : null}
    </div>
  );
}

/** Vertical stack of full-width touch actions (cards, dialogs, mobile CTAs). */
export function ActionStack({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("flex flex-col gap-2", className)} {...props}>
      {children}
    </div>
  );
}

/** Full-width on phones; natural width from `sm` when used in PageHeader. */
export const touchActionClassName = "min-h-11 w-full sm:w-auto";

/** Always full-width stacked actions (invoice cards, mobile forms). */
export const touchStackActionClassName = "min-h-11 w-full";
