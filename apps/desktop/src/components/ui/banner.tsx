import { type HTMLAttributes } from "react";
import { cn } from "./cn";

export type BannerTone =
  | "muted"
  | "info"
  | "success"
  | "warning"
  | "destructive";

const toneClasses: Record<BannerTone, string> = {
  muted: "border-border bg-muted/40 text-muted-foreground",
  info: "border-border bg-primary/5 text-foreground",
  success: "border-success/30 bg-success/10 text-foreground",
  warning: "border-warning/30 bg-warning/10 text-foreground",
  destructive: "border-destructive/30 bg-destructive/10 text-destructive",
};

interface BannerProps extends HTMLAttributes<HTMLDivElement> {
  tone?: BannerTone;
  title?: string;
}

/** Status / callout banner — pipeline, setup, success, errors. */
export function Banner({
  tone = "info",
  title,
  className,
  children,
  ...props
}: BannerProps) {
  return (
    <div
      className={cn(
        "rounded-lg border px-4 py-3 text-sm space-y-1",
        toneClasses[tone],
        className
      )}
      {...props}
    >
      {title ? <p className="font-medium">{title}</p> : null}
      {children}
    </div>
  );
}
