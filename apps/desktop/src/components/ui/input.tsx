import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

/** Shared control chrome — matches web Input (radius, border, focus ring). */
export const inputControlClassName =
  "block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

/** Compact control for dense grids (CPT units, etc.). */
export const inputCompactClassName =
  "rounded-md border border-border bg-background px-2 py-1 text-xs text-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
  compact?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, compact, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          compact ? inputCompactClassName : inputControlClassName,
          error &&
            "border-destructive focus:border-destructive focus:ring-destructive/20",
          className
        )}
        {...props}
      />
    );
  }
);

Input.displayName = "Input";
