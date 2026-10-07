import { type HTMLAttributes } from "react";
import { cn } from "./cn";

/** Surface for list rows / selectable items — not decorative chrome. */
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
        "rounded-lg border border-border p-3 transition-colors",
        selected && "border-primary bg-primary/5",
        interactive && !selected && "hover:bg-accent",
        className
      )}
      {...props}
    />
  );
}
