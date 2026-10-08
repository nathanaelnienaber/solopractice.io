import { type HTMLAttributes } from "react";
import { cn } from "./cn";

/**
 * Surfaces share one border/radius/padding language with web Cards.
 * - Surface: list rows / selectable items
 * - Panel: section chrome (forms, FAQ, stats) — opaque card, never transparent
 */

const surfaceBase =
  "rounded-lg border border-border bg-card text-card-foreground";

export function Surface({
  className,
  selected,
  interactive,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  selected?: boolean;
  interactive?: boolean;
}) {
  return (
    <div
      className={cn(
        surfaceBase,
        "p-3 transition-colors",
        selected && "border-primary bg-primary/5",
        interactive && !selected && "hover:bg-accent",
        className
      )}
      {...props}
    />
  );
}

/** Opaque section panel — borders + padding for form blocks / FAQ / grouped content. */
export function Panel({
  className,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn(surfaceBase, "p-4 space-y-3", className)} {...props} />
  );
}
