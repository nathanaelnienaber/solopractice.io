/** Tiny className joiner — no clsx/twMerge dependency in the desktop app. */
export function cn(
  ...parts: Array<string | false | null | undefined>
): string {
  return parts.filter(Boolean).join(" ");
}
