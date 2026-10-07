import { forwardRef, type TextareaHTMLAttributes } from "react";
import { cn } from "./cn";
import { inputControlClassName } from "./input";

interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  error?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        className={cn(
          inputControlClassName,
          "resize-y min-h-[6rem]",
          error &&
            "border-destructive focus:border-destructive focus:ring-destructive/20",
          className
        )}
        {...props}
      />
    );
  }
);

Textarea.displayName = "Textarea";
