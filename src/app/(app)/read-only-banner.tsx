"use client";

import { Info, WarningCircle } from "@phosphor-icons/react/ssr";
import { useSearchParams } from "next/navigation";
import { cn } from "@/lib/utils";

/** What a read-only account can do here, and, after it tried a change, why nothing changed. */
export function ReadOnlyBanner() {
  const refused = useSearchParams().get("read-only") === "1";
  return (
    <div
      role={refused ? "alert" : "note"}
      className={cn(
        "flex items-center justify-center gap-2 px-4 py-2.5 text-center text-small sm:px-6",
        refused
          ? "bg-warning-soft text-warning"
          : "bg-accent text-accent-foreground",
      )}
    >
      {refused ? (
        <WarningCircle aria-hidden="true" className="size-4 shrink-0" />
      ) : (
        <Info aria-hidden="true" className="size-4 shrink-0" />
      )}
      <span>
        {refused
          ? "That change wasn't saved: the demo account is read-only."
          : "You're in the read-only demo: look around, and try the assistant on the Assistant tab. Changes are switched off."}
      </span>
    </div>
  );
}
