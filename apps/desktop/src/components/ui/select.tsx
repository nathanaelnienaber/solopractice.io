import { forwardRef, type SelectHTMLAttributes } from "react";
import { cn } from "./cn";
import { inputControlClassName } from "./input";

interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  error?: boolean;
}

/**
 * Native select with kit chrome. Option popup colors come from index.css
 * (select option + color-scheme on .dark) — required on WebKitGTK/Omarchy.
 */
export const Select = forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, error, children, ...props }, ref) => {
    return (
      <select
        ref={ref}
        className={cn(
          inputControlClassName,
          "pr-8 appearance-auto",
          error &&
            "border-destructive focus:border-destructive focus:ring-destructive/20",
          className
        )}
        {...props}
      >
        {children}
      </select>
    );
  }
);

Select.displayName = "Select";
