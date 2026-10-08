import { CheckCircle, WarningCircle } from "@phosphor-icons/react/ssr";
import type { ReactNode } from "react";

// What a form says after it's sent, below the fields, with an icon in its tone (DESIGN.md,
// Fields). The icon sits on the first line however the text wraps.

/** Why a form didn't go through. */
export function FormError({ children }: { children: ReactNode }) {
  return (
    <p
      role="alert"
      className="flex items-start gap-1.5 text-small text-destructive"
    >
      <span className="flex h-lh shrink-0 items-center">
        <WarningCircle aria-hidden="true" className="size-4" />
      </span>
      <span>{children}</span>
    </p>
  );
}

/** That it went through: "Saved.", "Closure added." */
export function FormDone({ children }: { children: ReactNode }) {
  return (
    <p
      role="status"
      className="flex items-start gap-1.5 text-small text-success"
    >
      <span className="flex h-lh shrink-0 items-center">
        <CheckCircle aria-hidden="true" className="size-4" weight="fill" />
      </span>
      <span>{children}</span>
    </p>
  );
}
