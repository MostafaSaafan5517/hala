"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { X } from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
} from "react";
import { widgetLabels } from "@/app/widget/[slug]/labels";
import { ChatComposer } from "@/components/chat/chat-composer";
import { ChatMessages } from "@/components/chat/chat-messages";
import { chatLabels } from "@/components/chat/labels";
import { turnRequestBody } from "@/components/chat/turn-request";
import { Button } from "@/components/ui/button";
import type { CustomerLanguage } from "@/lib/assistant/language";
import type { Enums } from "@/lib/supabase/database.types";

type ConversationStatus = Enums<"conversation_status">;

/** How often the widget checks whether someone from the team has joined or replied. */
const POLL_MS = 5000;

// The visitor's conversation token, per business: kept in memory for this page view and in
// localStorage so a reload or a later visit picks the conversation up again. Storage can be
// unavailable (private windows, blocked third-party storage); the widget then still works for
// this page view.
const tokens = new Map<string, string>();

function storageKey(slug: string) {
  return `hala:${slug}:conversation`;
}

function tokenFor(slug: string) {
  if (!tokens.has(slug)) {
    try {
      const stored = window.localStorage.getItem(storageKey(slug));
      if (stored) tokens.set(slug, stored);
    } catch {
      // No storage: the conversation lasts this page view.
    }
  }
  return tokens.get(slug) ?? null;
}

function setTokenFor(slug: string, token: string | null) {
  if (token) tokens.set(slug, token);
  else tokens.delete(slug);
  try {
    if (token) window.localStorage.setItem(storageKey(slug), token);
    else window.localStorage.removeItem(storageKey(slug));
  } catch {
    // No storage: the conversation lasts this page view.
  }
}

// On a business's site (inside the frame its embed script adds), the widget offers to close
// itself. Not in the dashboard's preview, where Hala itself is the parent and nothing closes.
function onBusinessSite() {
  return (
    window.parent !== window &&
    window.location.ancestorOrigins?.[0] !== window.location.origin
  );
}
const noChanges = () => () => undefined;

export function WidgetChat({
  slug,
  businessName,
  initialLanguage,
}: {
  slug: string;
  businessName: string;
  initialLanguage: CustomerLanguage;
}) {
  const [language, setLanguage] = useState(initialLanguage);
  const [conversationStatus, setConversationStatus] =
    useState<ConversationStatus>("open");
  const [startError, setStartError] = useState<string | null>(null);
  const embedded = useSyncExternalStore(noChanges, onBusinessSite, () => false);
  const endRef = useRef<HTMLDivElement>(null);
  // Whether a reply is on its way, for checks that finish after a message was sent.
  const sendingRef = useRef(false);
  const labels = chatLabels[language];
  const words = widgetLabels[language];

  const {
    messages,
    setMessages,
    sendMessage,
    addToolApprovalResponse,
    status,
    error,
  } = useChat({
    transport: new DefaultChatTransport({
      api: `/api/widget/${slug}/chat`,
      // The server keeps the conversation: send only what's new, with the visitor's token.
      prepareSendMessagesRequest: ({ messages: current }) => ({
        body: turnRequestBody(current),
        headers: { Authorization: `Bearer ${tokenFor(slug)}` },
      }),
    }),
    sendAutomaticallyWhen: lastAssistantMessageIsCompleteWithApprovalResponses,
    // The turn may have changed the conversation (a request for a person): pick that up.
    onFinish: () => void reload(),
  });
  const busy = status === "submitted" || status === "streaming";
  useEffect(() => {
    sendingRef.current = busy;
  }, [busy]);

  /** The conversation as the server has it: messages, and whether a person has it. */
  const reload = useCallback(async () => {
    const token = tokenFor(slug);
    if (!token) return;
    const response = await fetch(`/api/widget/${slug}/messages`, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });
    if (response.status === 404) {
      setTokenFor(slug, null);
      setMessages([]);
      setConversationStatus("open");
      return;
    }
    if (!response.ok) return;
    const data = (await response.json()) as {
      status: ConversationStatus;
      messages: UIMessage[];
    };
    // A reply streaming in is newer than what the server had when it answered.
    if (sendingRef.current) return;
    setConversationStatus(data.status);
    setMessages(data.messages);
  }, [slug, setMessages]);

  useEffect(() => {
    void reload();
  }, [slug, reload]);

  // Someone from the team can join at any time (from the inbox): their replies, and the
  // conversation being taken over or closed, arrive by checking every few seconds.
  const ongoing = messages.length > 0 && conversationStatus !== "closed";
  useEffect(() => {
    if (!ongoing || busy) return;
    const timer = window.setInterval(() => void reload(), POLL_MS);
    return () => window.clearInterval(timer);
  }, [ongoing, busy, reload]);

  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
  }, [language]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages]);

  /** Sends a message, starting the conversation first if there isn't one. Says if it went. */
  async function send(text: string) {
    setStartError(null);
    if (!tokenFor(slug)) {
      const response = await fetch(`/api/widget/${slug}/conversations`, {
        method: "POST",
      });
      if (!response.ok) {
        setStartError(response.status === 429 ? words.tooMany : labels.error);
        return false;
      }
      const { token } = (await response.json()) as { token: string };
      setTokenFor(slug, token);
    }
    void sendMessage({ text });
    return true;
  }

  function startOver() {
    setTokenFor(slug, null);
    setMessages([]);
    setConversationStatus("open");
  }

  return (
    <div
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
      className="flex h-dvh flex-col bg-background"
    >
      <header className="flex items-center justify-between gap-2 border-b px-4 py-3">
        <h1 className="truncate text-sm font-semibold" dir="auto">
          {words.title(businessName)}
        </h1>
        <div className="flex shrink-0 items-center gap-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            lang={words.otherLanguage.code}
            onClick={() => setLanguage(words.otherLanguage.code)}
          >
            {words.otherLanguage.name}
          </Button>
          {embedded && (
            <Button
              type="button"
              variant="outline"
              size="icon-sm"
              aria-label={words.close}
              onClick={() =>
                window.parent.postMessage({ type: "hala:close" }, "*")
              }
            >
              <X aria-hidden="true" />
            </Button>
          )}
        </div>
      </header>

      <div
        role="log"
        aria-label={words.title(businessName)}
        className="grid flex-1 content-start gap-3 overflow-y-auto p-4"
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">{labels.empty}</p>
        )}
        <ChatMessages
          messages={messages}
          labels={labels}
          onAnswer={(id, approved) => addToolApprovalResponse({ id, approved })}
        />
        <div ref={endRef} />
      </div>

      <div className="grid gap-2 border-t p-4">
        {conversationStatus === "needs_human" && (
          <p role="status" className="text-xs text-muted-foreground">
            {words.waiting}
          </p>
        )}
        {conversationStatus === "taken_over" && (
          <p role="status" className="text-xs text-muted-foreground">
            {words.withTeam}
          </p>
        )}
        {busy && (
          <p role="status" className="text-xs text-muted-foreground">
            {labels.replying}
          </p>
        )}
        {(error || startError) && (
          <p role="alert" className="text-xs text-destructive">
            {startError ?? labels.error}
          </p>
        )}
        {conversationStatus === "closed" ? (
          <div className="grid justify-items-start gap-2">
            <p className="text-sm">{words.ended}</p>
            <Button type="button" variant="outline" onClick={startOver}>
              {words.newConversation}
            </Button>
          </div>
        ) : (
          <ChatComposer labels={labels} busy={busy} onSend={send} />
        )}
      </div>
    </div>
  );
}
