"use client";

import { useActionState } from "react";
import type { ReplyState } from "@/app/(app)/dashboard/b/[slug]/inbox/actions";
import { FormError } from "@/components/form-feedback";
import { surface } from "@/components/surface";
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
    <form action={formAction} className={`${surface} grid gap-3 p-5`}>
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
      {state.error && <FormError>{state.error}</FormError>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Sending..." : "Send reply"}
        </Button>
      </div>
    </form>
  );
}
