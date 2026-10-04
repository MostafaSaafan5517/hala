"use client";

import { useChat } from "@ai-sdk/react";
import {
  DefaultChatTransport,
  getToolName,
  isToolUIPart,
  lastAssistantMessageIsCompleteWithApprovalResponses,
  type UIMessage,
} from "ai";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { languageOfText } from "@/lib/assistant/language";

type ToolPart = Extract<
  UIMessage["parts"][number],
  { toolCallId: string; state: string }
>;

/** Arabic text gets the Arabic font and direction; other text follows its own direction. */
function TextBlock({ text, className }: { text: string; className?: string }) {
  const language = languageOfText(text);
  return (
    <p
      lang={language}
      dir={language === "ar" ? "rtl" : "auto"}
      className={`whitespace-pre-wrap ${className ?? ""}`}
    >
      {text}
    </p>
  );
}

const lookups: Record<string, string> = {
  search_knowledge: "Looked it up in the knowledge base",
  business_info: "Checked the business's details",
  check_availability: "Checked availability",
  find_bookings: "Looked up bookings",
  request_human: "Asked the team to take over",
};

const done: Record<string, (output: Record<string, unknown>) => string> = {
  book_appointment: (output) => `Booked · ${String(output.reference)}`,
  reschedule_booking: (output) => `Moved · ${String(output.reference)}`,
  cancel_booking: (output) => `Cancelled · ${String(output.reference)}`,
};

function ToolStatus({
  part,
  onAnswer,
}: {
  part: ToolPart;
  onAnswer: (id: string, approved: boolean) => void;
}) {
  const name = getToolName(part as Parameters<typeof getToolName>[0]);
  const note = "text-xs text-muted-foreground";

  if (
    part.state === "approval-requested" &&
    "approval" in part &&
    part.approval
  ) {
    if (part.approval.isAutomatic) return null;
    return (
      <div
        role="group"
        aria-label="Confirm"
        className="grid gap-3 rounded-lg border border-foreground/20 bg-muted/40 p-3 text-sm"
      >
        <TextBlock text={part.approval.requestReason ?? "Go ahead?"} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => onAnswer(part.approval!.id, true)}
          >
            Confirm
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onAnswer(part.approval!.id, false)}
          >
            Not now
          </Button>
        </div>
      </div>
    );
  }
  if (part.state === "approval-responded") {
    return <p className={note}>Confirming...</p>;
  }
  if (part.state === "output-denied") {
    return (
      <p className={note}>
        {"approval" in part && part.approval?.isAutomatic
          ? "Couldn't go ahead."
          : "Not confirmed."}
      </p>
    );
  }
  if (part.state === "output-available" && "output" in part) {
    const output = part.output as Record<string, unknown>;
    const describe = done[name];
    if (describe) {
      return (
        <p className={note}>
          {output.ok ? describe(output) : "Couldn't complete it."}
        </p>
      );
    }
    return lookups[name] ? <p className={note}>{lookups[name]}</p> : null;
  }
  return null;
}

/** The passages the assistant cited from, numbered as it cites them. */
function Sources({ parts }: { parts: ToolPart[] }) {
  const passages = parts.flatMap((part) =>
    getToolName(part as Parameters<typeof getToolName>[0]) ===
      "search_knowledge" &&
    part.state === "output-available" &&
    "output" in part
      ? ((part.output as { passages?: { source: number; title: string }[] })
          .passages ?? [])
      : [],
  );
  if (passages.length === 0) return null;
  return (
    <div className="text-xs text-muted-foreground">
      <span>Sources: </span>
      <ol className="inline">
        {passages.map((passage) => (
          <li
            key={passage.source}
            className="inline after:content-[',_'] last:after:content-none"
          >
            [{passage.source}]{" "}
            <span dir="auto" lang={languageOfText(passage.title)}>
              {passage.title}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function AssistantChat({
  conversationId,
  initialMessages,
}: {
  conversationId: string;
  initialMessages: UIMessage[];
}) {
  const [draft, setDraft] = useState("");
  const { messages, sendMessage, addToolApprovalResponse, status, error } =
    useChat({
      id: conversationId,
      messages: initialMessages,
      transport: new DefaultChatTransport({
        api: `/api/assistant/${conversationId}`,
        // The server keeps the conversation: send only what's new. A new message, or the
        // answers to the approval requests in the last reply.
        prepareSendMessagesRequest: ({ messages: current }) => {
          const last = current.at(-1);
          if (last?.role === "user") {
            return {
              body: {
                text: last.parts
                  .map((part) => (part.type === "text" ? part.text : ""))
                  .join(""),
              },
            };
          }
          const approvals = (last?.parts ?? []).flatMap((part) =>
            isToolUIPart(part) && part.state === "approval-responded"
              ? [{ id: part.approval.id, approved: part.approval.approved }]
              : [],
          );
          return { body: { approvals } };
        },
      }),
      // Once every request in the reply is answered, carry on.
      sendAutomaticallyWhen:
        lastAssistantMessageIsCompleteWithApprovalResponses,
    });
  const busy = status === "submitted" || status === "streaming";

  return (
    <div className="grid gap-4">
      <div
        role="log"
        aria-label="Conversation"
        className="grid gap-3 rounded-lg border p-4"
      >
        {messages.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Say hello, ask a question, or ask to book.
          </p>
        )}
        {messages.map((message) => {
          const toolParts = message.parts.filter(isToolUIPart) as ToolPart[];
          return (
            <div
              key={message.id}
              className={
                message.role === "user"
                  ? "grid max-w-[85%] gap-1 justify-self-end rounded-lg bg-muted px-3 py-2 text-sm"
                  : "grid max-w-[85%] gap-2 justify-self-start text-sm"
              }
            >
              <span className="sr-only">
                {message.role === "user" ? "You:" : "Assistant:"}
              </span>
              {message.parts.map((part, index) => {
                if (part.type === "text") {
                  return <TextBlock key={index} text={part.text} />;
                }
                if (isToolUIPart(part)) {
                  return (
                    <ToolStatus
                      key={part.toolCallId}
                      part={part as ToolPart}
                      onAnswer={(id, approved) =>
                        addToolApprovalResponse({ id, approved })
                      }
                    />
                  );
                }
                return null;
              })}
              <Sources parts={toolParts} />
            </div>
          );
        })}
      </div>

      {busy && (
        <p role="status" className="text-sm text-muted-foreground">
          The assistant is replying...
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          Something went wrong. Please try again.
        </p>
      )}

      <form
        className="grid gap-2"
        onSubmit={(event) => {
          event.preventDefault();
          const text = draft.trim();
          if (!text || busy) return;
          void sendMessage({ text });
          setDraft("");
        }}
      >
        <Label htmlFor="chat-message">Message</Label>
        <Textarea
          id="chat-message"
          dir="auto"
          rows={2}
          maxLength={2000}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              event.currentTarget.form?.requestSubmit();
            }
          }}
        />
        <div>
          <Button type="submit" disabled={busy || draft.trim() === ""}>
            Send
          </Button>
        </div>
      </form>
    </div>
  );
}
