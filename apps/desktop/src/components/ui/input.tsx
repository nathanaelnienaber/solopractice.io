import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

export const inputControlClassName =
  "block w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:cursor-not-allowed disabled:opacity-50";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  error?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <input
        ref={ref}
        className={cn(
          inputControlClassName,
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
