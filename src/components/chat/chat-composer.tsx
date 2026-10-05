"use client";

import { useSyncExternalStore } from "react";
import type { ChatLabels } from "@/components/chat/labels";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const noChanges = () => () => undefined;

/**
 * The message box: Enter sends, Shift+Enter starts a new line. The text isn't held in React
 * state but read when it's sent, so what someone types while the page is still loading is
 * kept; it's cleared only once the message is on its way. Send works once the page has loaded:
 * before that, the browser would submit the form itself and reload the page, losing the text.
 */
export function ChatComposer({
  labels,
  busy,
  onSend,
}: {
  labels: ChatLabels;
  busy: boolean;
  /** Resolves to whether the message went: if not, the text stays in the box. */
  onSend: (text: string) => Promise<boolean>;
}) {
  const ready = useSyncExternalStore(
    noChanges,
    () => true,
    () => false,
  );
  return (
    <form
      className="grid gap-2"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const text = String(new FormData(form).get("message") ?? "").trim();
        if (!text || busy) return;
        if (await onSend(text)) form.reset();
      }}
    >
      <Label htmlFor="chat-message">{labels.message}</Label>
      <Textarea
        id="chat-message"
        name="message"
        dir="auto"
        rows={2}
        maxLength={2000}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <div>
        <Button type="submit" disabled={busy || !ready}>
          {labels.send}
        </Button>
      </div>
    </form>
  );
}
