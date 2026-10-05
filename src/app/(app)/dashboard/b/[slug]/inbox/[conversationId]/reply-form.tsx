"use client";

import { useActionState } from "react";
import type { ReplyState } from "@/app/(app)/dashboard/b/[slug]/inbox/actions";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function ReplyForm({
  action,
}: {
  action: (previous: ReplyState, formData: FormData) => Promise<ReplyState>;
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    text: "",
  });

  // React resets the form after each submit; the key re-mounts the box with what came back, so
  // a reply that didn't go keeps its text.
  return (
    <form action={formAction} className="grid gap-2">
      <Label htmlFor="reply">Reply to the customer</Label>
      <Textarea
        key={state.text}
        id="reply"
        name="reply"
        dir="auto"
        rows={3}
        maxLength={2000}
        defaultValue={state.text}
      />
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending..." : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
