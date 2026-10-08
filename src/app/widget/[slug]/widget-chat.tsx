"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import {
  ChatCircleDots,
  Clock,
  Globe,
  type Icon,
  UserCircle,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
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
import { cn } from "@/lib/utils";

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

// Inside the frame the embed script adds (on a business's site, or the demo's), which it names,
// the widget offers to close itself: on phones the chat fills the screen and this is the way
// out. Not in the dashboard's preview, where nothing closes.
function inEmbedFrame() {
  return window.parent !== window && window.name === "hala-widget";
}
const noChanges = () => () => undefined;

/** A note above the message box about the conversation, with an icon in its tone. */
function StateNote({
  role,
  icon: Glyph,
  className,
  children,
}: {
  role: "status" | "alert";
  icon: Icon;
  className: string;
  children: string;
}) {
  return (
    <p
      role={role}
      className={cn("flex items-start gap-1.5 px-1 text-caption", className)}
    >
      <span className="flex h-lh shrink-0 items-center">
        <Glyph size={14} aria-hidden="true" />
      </span>
      <span>{children}</span>
    </p>
  );
}

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
  const embedded = useSyncExternalStore(noChanges, inEmbedFrame, () => false);
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

  // The business's initial, in the header (DESIGN.md: the widget belongs to the business).
  const initial = Array.from(businessName.trim())[0]?.toLocaleUpperCase();

  return (
    <div
      lang={language}
      dir={language === "ar" ? "rtl" : "ltr"}
      // Light on every website, whatever the visitor's device prefers (DESIGN.md).
      className="hala-light flex h-dvh flex-col bg-card"
    >
      <header className="flex shrink-0 items-center gap-2 border-b py-2 ps-3 pe-2">
        <span
          aria-hidden="true"
          className="grid size-9 shrink-0 place-items-center rounded-full bg-primary text-body font-semibold text-primary-foreground"
        >
          {initial}
        </span>
        <h1
          className="min-w-0 flex-1 truncate text-body font-semibold"
          dir="auto"
        >
          {words.title(businessName)}
        </h1>
        <Button
          type="button"
          variant="ghost"
          lang={words.otherLanguage.code}
          className="h-11 shrink-0 gap-1.5 rounded-full px-3 text-small text-secondary-foreground"
          onClick={() => setLanguage(words.otherLanguage.code)}
        >
          <Globe aria-hidden="true" />
          {words.otherLanguage.name}
        </Button>
        {embedded && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label={words.close}
            className="size-11 shrink-0 rounded-full text-secondary-foreground"
            onClick={() =>
              window.parent.postMessage({ type: "hala:close" }, "*")
            }
          >
            <X aria-hidden="true" className="size-5" />
          </Button>
        )}
      </header>

      <main className="flex min-h-0 flex-1 flex-col">
        <div
          role="log"
          aria-label={words.title(businessName)}
          className={cn(
            "grid flex-1 grid-cols-[minmax(0,1fr)] gap-3 overflow-y-auto p-4",
            messages.length === 0 ? "content-center" : "content-start",
          )}
        >
          {messages.length === 0 && (
            <div className="grid justify-items-center gap-2 text-center">
              <span className="mb-1 grid size-12 place-items-center rounded-full bg-accent text-accent-foreground">
                <ChatCircleDots size={24} aria-hidden="true" />
              </span>
              <p className="text-h3">{words.welcome}</p>
              <p className="max-w-[32ch] text-small text-secondary-foreground">
                {labels.empty}
              </p>
            </div>
          )}
          <ChatMessages
            messages={messages}
            labels={labels}
            replying={busy}
            onAnswer={(id, approved) =>
              addToolApprovalResponse({ id, approved })
            }
          />
          <div ref={endRef} />
        </div>

        <div className="grid grid-cols-[minmax(0,1fr)] gap-2 border-t p-3">
          {conversationStatus === "needs_human" && (
            <StateNote role="status" icon={Clock} className="text-warning">
              {words.waiting}
            </StateNote>
          )}
          {conversationStatus === "taken_over" && (
            <StateNote
              role="status"
              icon={UserCircle}
              className="text-accent-foreground"
            >
              {words.withTeam}
            </StateNote>
          )}
          {/* The typing dots show it; this says it to screen readers. */}
          {busy && (
            <p role="status" className="sr-only">
              {labels.replying}
            </p>
          )}
          {(error || startError) && (
            <StateNote
              role="alert"
              icon={WarningCircle}
              className="text-destructive"
            >
              {startError ?? labels.error}
            </StateNote>
          )}
          {conversationStatus === "closed" ? (
            <div className="grid justify-items-center gap-3 py-1 text-center">
              <p className="text-small text-secondary-foreground">
                {words.ended}
              </p>
              <Button
                type="button"
                className="h-11 px-4 text-body"
                onClick={startOver}
              >
                {words.newConversation}
              </Button>
            </div>
          ) : (
            <ChatComposer labels={labels} busy={busy} onSend={send} />
          )}
        </div>
      </main>
    </div>
  );
}
