import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

const tones = {
  neutral: "bg-muted text-secondary-foreground",
  accent: "bg-accent text-accent-foreground",
  success: "bg-success-soft text-success",
  warning: "bg-warning-soft text-warning",
  danger: "bg-destructive-soft text-destructive",
} as const;

export type BadgeTone = keyof typeof tones;

/** A status in its tone, with an icon and a word: never color alone (DESIGN.md, Badges). */
export function Badge({
  tone = "neutral",
  icon,
  children,
  className,
}: {
  tone?: BadgeTone;
  icon?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-badge px-2 py-0.5 text-caption font-medium whitespace-nowrap [&_svg]:size-3.5 [&_svg]:shrink-0",
        tones[tone],
        className,
      )}
    >
      {icon}
      {children}
    </span>
  );
}
