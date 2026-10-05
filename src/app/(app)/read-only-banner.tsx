"use client";

import { useSearchParams } from "next/navigation";

/** What a read-only account can do here, and, after it tried a change, why nothing changed. */
export function ReadOnlyBanner() {
  const refused = useSearchParams().get("read-only") === "1";
  return (
    <div
      role={refused ? "alert" : "note"}
      className="border-b bg-muted px-4 py-2 text-center text-sm sm:px-6"
    >
      {refused
        ? "That change wasn't saved: the demo account is read-only."
        : "You're in the read-only demo: look around, and try the assistant on the Assistant tab. Changes are switched off."}
    </div>
  );
}
