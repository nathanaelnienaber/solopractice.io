import { forwardRef, type InputHTMLAttributes } from "react";
import { cn } from "./cn";

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  label?: string;
}

export const Checkbox = forwardRef<HTMLInputElement, CheckboxProps>(
  ({ className, label, id, ...props }, ref) => {
    const inputId = id ?? props.name;

    return (
      <label
        htmlFor={inputId}
        className={cn(
          "inline-flex items-center gap-3 text-sm text-foreground cursor-pointer select-none",
          props.disabled && "opacity-50 cursor-not-allowed"
        )}
      >
        <input
          ref={ref}
          id={inputId}
          type="checkbox"
          className={cn(
            "h-4 w-4 shrink-0 rounded border border-border bg-background text-primary",
            "accent-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/40",
            className
          )}
          {...props}
        />
        {label ? <span className="font-normal">{label}</span> : null}
      </label>
    );
  }
);

Checkbox.displayName = "Checkbox";
