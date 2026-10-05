"use client";

import { getToolName, isToolUIPart, type UIMessage } from "ai";
import Markdown from "react-markdown";
import type { ChatLabels } from "@/components/chat/labels";
import { Button } from "@/components/ui/button";
import { languageOfText } from "@/lib/assistant/language";
import { cn } from "@/lib/utils";

// The conversation as the customer (or a member testing it) sees it: their messages, the
// assistant's and staff's replies, what the assistant looked up, the passages it cited, and a
// card to confirm or decline each booking, move or cancellation.

type ToolPart = Extract<
  UIMessage["parts"][number],
  { toolCallId: string; state: string }
>;

function toolNameOf(part: ToolPart) {
  return getToolName(part as Parameters<typeof getToolName>[0]);
}

/** Only what a reply needs; never raw HTML. Links open in a new tab and can't be scripts. */
const REPLY_ELEMENTS = [
  "p",
  "strong",
  "em",
  "ul",
  "ol",
  "li",
  "a",
  "code",
  "br",
];

function Reply({ text }: { text: string }) {
  const language = languageOfText(text);
  return (
    <div
      lang={language}
      dir={language === "ar" ? "rtl" : "auto"}
      className="grid gap-2 [&_a]:underline [&_ol]:list-decimal [&_ol]:ps-5 [&_ul]:list-disc [&_ul]:ps-5"
    >
      <Markdown
        allowedElements={REPLY_ELEMENTS}
        unwrapDisallowed
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer nofollow">
              {children}
            </a>
          ),
        }}
      >
        {text}
      </Markdown>
    </div>
  );
}

function Typed({ text }: { text: string }) {
  const language = languageOfText(text);
  return (
    <p
      lang={language}
      dir={language === "ar" ? "rtl" : "auto"}
      className="whitespace-pre-wrap"
    >
      {text}
    </p>
  );
}

function ToolStatus({
  part,
  labels,
  onAnswer,
}: {
  part: ToolPart;
  labels: ChatLabels;
  onAnswer: (id: string, approved: boolean) => void;
}) {
  const name = toolNameOf(part);
  const note = "text-xs text-muted-foreground";
  const approval = "approval" in part ? part.approval : undefined;

  if (part.state === "approval-requested" && approval) {
    if (approval.isAutomatic) return null;
    return (
      <div
        role="group"
        aria-label={labels.confirm}
        className="grid gap-3 rounded-lg border border-foreground/20 bg-muted/40 p-3"
      >
        <Typed text={approval.requestReason ?? labels.confirm} />
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            onClick={() => onAnswer(approval.id, true)}
          >
            {labels.confirm}
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() => onAnswer(approval.id, false)}
          >
            {labels.notNow}
          </Button>
        </div>
      </div>
    );
  }
  if (part.state === "approval-responded") {
    return <p className={note}>{labels.confirming}</p>;
  }
  if (part.state === "output-denied") {
    return (
      <p className={note}>
        {approval?.isAutomatic ? labels.couldNotGoAhead : labels.notConfirmed}
      </p>
    );
  }
  if (part.state === "output-available" && "output" in part) {
    const output = part.output as { ok?: boolean; reference?: string };
    const done = {
      book_appointment: labels.booked,
      reschedule_booking: labels.moved,
      cancel_booking: labels.cancelled,
    }[name];
    if (done) {
      return (
        <p className={note}>
          {output.ok ? done(String(output.reference)) : labels.couldNotComplete}
        </p>
      );
    }
    return labels.lookups[name] ? (
      <p className={note}>{labels.lookups[name]}</p>
    ) : null;
  }
  return null;
}

/** The passages the assistant cited from, numbered as it cites them. */
function Sources({ parts, label }: { parts: ToolPart[]; label: string }) {
  const passages = parts.flatMap((part) =>
    toolNameOf(part) === "search_knowledge" &&
    part.state === "output-available" &&
    "output" in part
      ? ((part.output as { passages?: { source: number; title: string }[] })
          .passages ?? [])
      : [],
  );
  if (passages.length === 0) return null;
  return (
    <div className="text-xs text-muted-foreground">
      <span>{label} </span>
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

export function ChatMessages({
  messages,
  labels,
  onAnswer,
}: {
  messages: UIMessage[];
  labels: ChatLabels;
  onAnswer: (id: string, approved: boolean) => void;
}) {
  return (
    messages
      // A reply with nothing in it yet (or none at all, while a person has the conversation).
      .filter((message) => message.parts.length > 0)
      .map((message) => {
        const fromStaff =
          (message.metadata as { from?: string } | undefined)?.from === "staff";
        const toolParts = message.parts.filter(isToolUIPart) as ToolPart[];
        return (
          <div
            key={message.id}
            className={cn(
              "grid max-w-[85%] gap-2 text-sm",
              message.role === "user"
                ? "justify-self-end rounded-lg bg-muted px-3 py-2"
                : "justify-self-start",
              fromStaff && "rounded-lg border px-3 py-2",
            )}
          >
            <span className="sr-only">
              {message.role === "user" ? labels.you : labels.assistant}
            </span>
            {fromStaff && (
              <span className="text-xs font-medium text-muted-foreground">
                {labels.team}
              </span>
            )}
            {message.parts.map((part, index) => {
              if (part.type === "text") {
                return message.role === "user" || fromStaff ? (
                  <Typed key={index} text={part.text} />
                ) : (
                  <Reply key={index} text={part.text} />
                );
              }
              if (isToolUIPart(part)) {
                return (
                  <ToolStatus
                    key={part.toolCallId}
                    part={part as ToolPart}
                    labels={labels}
                    onAnswer={onAnswer}
                  />
                );
              }
              return null;
            })}
            <Sources parts={toolParts} label={labels.sources} />
          </div>
        );
      })
  );
}
