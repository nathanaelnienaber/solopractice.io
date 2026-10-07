import { type LabelHTMLAttributes } from "react";
import { cn } from "./cn";

interface LabelProps extends LabelHTMLAttributes<HTMLLabelElement> {
  hint?: boolean;
}

export function Label({ className, hint, ...props }: LabelProps) {
  return (
    <label
      className={cn(
        hint
          ? "block text-xs font-medium text-muted-foreground"
          : "block text-sm font-medium text-foreground",
        className
      )}
      {...props}
    />
  );
}
