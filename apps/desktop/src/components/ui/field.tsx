import { type HTMLAttributes, type ReactNode } from "react";
import { cn } from "./cn";
import { Label } from "./label";

interface FieldProps extends Omit<HTMLAttributes<HTMLDivElement>, "title"> {
  label?: ReactNode;
  htmlFor?: string;
  hint?: ReactNode;
  error?: ReactNode;
  /** Stack label above control (default). */
  orientation?: "vertical" | "horizontal";
}

/** Label + control + optional hint/error. Use for every form control. */
export function Field({
  label,
  htmlFor,
  hint,
  error,
  orientation = "vertical",
  className,
  children,
  ...props
}: FieldProps) {
  if (orientation === "horizontal") {
    return (
      <div
        className={cn("flex items-center gap-3", className)}
        {...props}
      >
        {label ? (
          <Label htmlFor={htmlFor} className="shrink-0 mb-0">
            {label}
          </Label>
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    );
  }

  return (
    <div className={cn("space-y-1.5", className)} {...props}>
      {label ? <Label htmlFor={htmlFor}>{label}</Label> : null}
      {children}
      {error ? (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      ) : hint ? (
        <p className="text-xs text-muted-foreground">{hint}</p>
      ) : null}
    </div>
  );
}

/** Two-column form grid used on Superbill / Settings-style forms. */
export function FormGrid({
  className,
  cols = 2,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement> & { cols?: 2 | 3 }) {
  return (
    <div
      className={cn(
        "grid gap-4",
        cols === 2 ? "grid-cols-1 sm:grid-cols-2" : "grid-cols-1 sm:grid-cols-3",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
