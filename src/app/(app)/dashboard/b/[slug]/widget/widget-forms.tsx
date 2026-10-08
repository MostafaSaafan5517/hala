"use client";

import { useActionState, useState } from "react";
import type { WidgetFormState } from "@/app/(app)/dashboard/b/[slug]/widget/actions";
import { FormDone, FormError } from "@/components/form-feedback";
import { surface } from "@/components/surface";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export function WidgetSettingsForm({
  action,
  enabled,
  origins,
}: {
  action: (
    previous: WidgetFormState,
    formData: FormData,
  ) => Promise<WidgetFormState>;
  enabled: boolean;
  origins: string[];
}) {
  const [state, formAction, pending] = useActionState(action, {
    error: null,
    saved: false,
    enabled,
    origins: origins.join("\n"),
  });

  // React resets the form after each submit; the keys re-mount the fields with what came back,
  // so a refused save keeps the box ticked and the sites typed.
  return (
    <form action={formAction} className={`${surface} grid gap-5 p-5 sm:p-6`}>
      <label className="flex items-center gap-2 font-medium">
        <input
          key={String(state.enabled)}
          type="checkbox"
          name="enabled"
          defaultChecked={state.enabled}
          className="size-4 accent-primary"
        />
        Show the widget on your website
      </label>
      <div className="grid gap-2">
        <Label htmlFor="origins">Websites allowed to show it</Label>
        <Textarea
          key={state.origins}
          id="origins"
          name="origins"
          dir="ltr"
          rows={3}
          placeholder="https://your-site.com"
          defaultValue={state.origins}
          aria-describedby="origins-hint"
        />
        <p id="origins-hint" className="text-caption text-muted-foreground">
          One per line, with https://. Browsers refuse to show the widget on any
          other site.
        </p>
      </div>
      {state.error && <FormError>{state.error}</FormError>}
      {state.saved && <FormDone>Saved.</FormDone>}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save"}
        </Button>
      </div>
    </form>
  );
}

export function EmbedCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className={`${surface} grid gap-3 p-5 sm:p-6`}>
      <Label htmlFor="embed-code">Embed code</Label>
      <Textarea
        id="embed-code"
        readOnly
        dir="ltr"
        rows={2}
        value={code}
        className="font-mono text-small md:text-small"
        onFocus={(event) => event.currentTarget.select()}
      />
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={async () => {
            await navigator.clipboard.writeText(code);
            setCopied(true);
          }}
        >
          Copy
        </Button>
        {copied && (
          <span role="status" className="text-small text-success">
            Copied.
          </span>
        )}
      </div>
    </div>
  );
}
