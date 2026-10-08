import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";

/**
 * Opaque modal overlay + panel. Never use bg-card without the token, and never
 * use translucent panel backgrounds — content underneath must not show through.
 */

interface DialogProps extends HTMLAttributes<HTMLDivElement> {
  open?: boolean;
  onDismiss?: () => void;
  /** Max width of the panel. Default md. */
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClass: Record<NonNullable<DialogProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-2xl",
};

export function Dialog({
  open = true,
  onDismiss,
  size = "md",
  className,
  children,
  ...props
}: DialogProps) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="presentation"
    >
      <div
        className="absolute inset-0 bg-overlay"
        aria-hidden
        onClick={onDismiss}
      />
      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "relative z-10 w-full rounded-lg border border-border bg-card text-card-foreground shadow-dialog",
          sizeClass[size],
          className
        )}
        {...props}
      >
        {children}
      </div>
    </div>
  );
}

export function DialogHeader({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("space-y-1.5 p-5 pb-0", className)} {...props}>
      {children}
    </div>
  );
}

export function DialogTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h2 className={cn("text-lg font-semibold tracking-tight", className)} {...props}>
      {children}
    </h2>
  );
}

export function DialogDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn("text-sm text-muted-foreground", className)} {...props}>
      {children}
    </p>
  );
}

export function DialogBody({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("p-5 space-y-4", className)} {...props}>
      {children}
    </div>
  );
}

export function DialogFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-center justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3 rounded-b-lg",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}

/** Convenience: title + description block inside a Dialog. */
export function DialogIntro({
  title,
  description,
  titleId,
}: {
  title: ReactNode;
  description?: ReactNode;
  titleId?: string;
}) {
  return (
    <div className="space-y-1">
      <DialogTitle id={titleId}>{title}</DialogTitle>
      {description ? <DialogDescription>{description}</DialogDescription> : null}
    </div>
  );
}
