"use client";

import { WarningCircle } from "@phosphor-icons/react/ssr";
import { surface } from "@/components/surface";
import { Button } from "@/components/ui/button";

// Shown inside the signed-in layout when a page throws. The server has already logged the
// error; its digest lets a report be matched with that log entry.
export default function SignedInError({
  error,
  retry,
}: {
  error: Error & { digest?: string };
  retry: () => void;
}) {
  return (
    <div
      role="alert"
      className={`${surface} grid max-w-xl justify-items-start gap-3 p-6`}
    >
      <span className="grid size-12 place-items-center rounded-full bg-destructive-soft text-destructive">
        <WarningCircle aria-hidden="true" className="size-6" />
      </span>
      <h1 className="text-h3">Something went wrong</h1>
      <p className="text-secondary-foreground">
        We couldn&apos;t load this page. Please try again in a moment.
      </p>
      {error.digest && (
        <p className="text-caption text-muted-foreground">
          Reference: {error.digest}
        </p>
      )}
      <Button onClick={() => retry()}>Try again</Button>
    </div>
  );
}
