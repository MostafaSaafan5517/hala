"use client";

import { PaperPlaneRight } from "@phosphor-icons/react";
import { useSyncExternalStore } from "react";
import type { ChatLabels } from "@/components/chat/labels";
import { Button } from "@/components/ui/button";

const noChanges = () => () => undefined;

/**
 * The message box: one line that grows as it fills, with an icon button to send. Enter sends,
 * Shift+Enter starts a new line. The text isn't held in React state but read when it's sent, so
 * what someone types while the page is still loading is kept; it's cleared only once the message
 * is on its way. Send works once the page has loaded: before that, the browser would submit the
 * form itself and reload the page, losing the text.
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
      // The field's outline and focus ring are drawn around the box, send button included.
      className="flex items-end gap-2 rounded-[14px] border border-input bg-card p-1 ps-3 has-[textarea:focus]:ring-2 has-[textarea:focus]:ring-ring has-[textarea:focus]:ring-offset-2 has-[textarea:focus]:ring-offset-background"
      onSubmit={async (event) => {
        event.preventDefault();
        const form = event.currentTarget;
        const text = String(new FormData(form).get("message") ?? "").trim();
        if (!text || busy) return;
        if (await onSend(text)) form.reset();
      }}
    >
      {/* Read by screen readers; the placeholder says it on screen. */}
      <label htmlFor="chat-message" className="sr-only">
        {labels.message}
      </label>
      <textarea
        id="chat-message"
        name="message"
        dir="auto"
        rows={1}
        maxLength={2000}
        placeholder={labels.placeholder}
        // 16px, so phones don't zoom in when it's focused.
        className="field-sizing-content max-h-32 min-h-11 min-w-0 flex-1 resize-none bg-transparent py-2.5 text-base outline-none placeholder:text-muted-foreground"
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <Button
        type="submit"
        size="icon"
        aria-label={labels.send}
        disabled={busy || !ready}
        className="size-11"
      >
        <PaperPlaneRight
          weight="fill"
          aria-hidden="true"
          className="size-5 rtl:-scale-x-100"
        />
      </Button>
    </form>
  );
}
