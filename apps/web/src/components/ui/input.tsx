"use client";

import { forwardRef, type InputHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(
  ({ className = "", label, error, id, ...props }, ref) => {
    const inputId = id || props.name;

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-sm font-medium text-foreground"
          >
            {label}
          </label>
        )}
        <input
          ref={ref}
          id={inputId}
          className={`
            block w-full rounded-lg border border-border bg-background px-3 py-2
            text-foreground placeholder:text-muted-foreground
            focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20
            disabled:cursor-not-allowed disabled:opacity-50
            ${error ? "border-destructive focus:border-destructive focus:ring-destructive/20" : ""}
            ${className}
          `}
          {...props}
        />
        {error && <p className="text-sm text-destructive">{error}</p>}
      </div>
    );
  }
);

Input.displayName = "Input";
