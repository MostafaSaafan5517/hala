"use client";

import {
  CalendarBlank,
  CalendarCheck,
  CalendarX,
  CheckCircle,
  Clock,
  type Icon,
  MagnifyingGlass,
  Storefront,
  UserCircle,
  WarningCircle,
  X,
} from "@phosphor-icons/react";
import { getToolName, isToolUIPart, type UIMessage } from "ai";
import type { ReactNode } from "react";
import Markdown from "react-markdown";
import type { ChatLabels } from "@/components/chat/labels";
import { Button } from "@/components/ui/button";
import { languageOfText } from "@/lib/assistant/language";
import { cn } from "@/lib/utils";

// The conversation as the customer (or a member testing it) sees it: their messages, the
// assistant's and staff's replies, what the assistant looked up, the passages it cited, and a
// card to confirm or decline each booking, move or cancellation (docs/design/DESIGN.md, "The
// chat").

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

/** The assistant's reply: Markdown, limited to the elements above. */
export function Reply({ text }: { text: string }) {
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

/**
 * A phone number, with its brackets if it has them. Inside Arabic it would otherwise reorder
 * itself ("(+966 50 123 4567)" turning into "(4567 123 50 966+)"), so it's isolated as one
 * left-to-right run that doesn't break across lines.
 */
const PHONE = /(\(\+?\d[\d ]*\d\)|\+?\d(?: ?\d){6,})/;

function withIsolatedPhones(text: string) {
  return text.split(PHONE).map((piece, index) =>
    index % 2 === 1 ? (
      <bdi key={index} dir="ltr" className="whitespace-nowrap">
        {piece}
      </bdi>
    ) : (
      piece
    ),
  );
}

/** What a person typed, as typed: never Markdown. */
export function Typed({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const language = languageOfText(text);
  return (
    <p
      lang={language}
      dir={language === "ar" ? "rtl" : "auto"}
      className={cn("whitespace-pre-wrap", className)}
    >
      {withIsolatedPhones(text)}
    </p>
  );
}

/** A quiet line about what the assistant did, with an icon in its tone. */
function ProcessLine({
  icon: Glyph,
  className,
  children,
}: {
  icon: Icon;
  className?: string;
  children: ReactNode;
}) {
  return (
    <p
      className={cn(
        "flex items-start gap-1.5 text-caption text-muted-foreground",
        className,
      )}
    >
      <span className="flex h-lh shrink-0 items-center">
        <Glyph size={14} aria-hidden="true" />
      </span>
      <span>{children}</span>
    </p>
  );
}

/** The icon beside each kind of lookup. */
const lookupIcons: Record<string, Icon> = {
  search_knowledge: MagnifyingGlass,
  business_info: Storefront,
  check_availability: CalendarBlank,
  find_bookings: MagnifyingGlass,
  request_human: UserCircle,
};

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
  const approval = "approval" in part ? part.approval : undefined;

  if (part.state === "approval-requested" && approval) {
    if (approval.isAutomatic) return null;
    const Calendar = name === "cancel_booking" ? CalendarX : CalendarCheck;
    return (
      <div
        role="group"
        aria-label={labels.confirm}
        className="my-1 grid w-full gap-3 justify-self-stretch rounded-surface bg-card p-4 shadow-level-2"
      >
        <span className="grid size-9 place-items-center rounded-full bg-accent text-accent-foreground">
          <Calendar size={20} aria-hidden="true" />
        </span>
        <Typed
          text={approval.requestReason ?? labels.confirm}
          className="text-large font-medium"
        />
        <div className="grid grid-cols-2 gap-2">
          <Button
            type="button"
            className="h-11 text-body"
            onClick={() => onAnswer(approval.id, true)}
          >
            {labels.confirm}
          </Button>
          <Button
            type="button"
            variant="secondary"
            className="h-11 text-body text-foreground"
            onClick={() => onAnswer(approval.id, false)}
          >
            {labels.notNow}
          </Button>
        </div>
      </div>
    );
  }
  if (part.state === "approval-responded") {
    return <ProcessLine icon={Clock}>{labels.confirming}</ProcessLine>;
  }
  if (part.state === "output-denied") {
    return (
      <ProcessLine icon={X}>
        {approval?.isAutomatic ? labels.couldNotGoAhead : labels.notConfirmed}
      </ProcessLine>
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
      return output.ok ? (
        <ProcessLine icon={CheckCircle} className="font-medium text-success">
          {done(String(output.reference))}
        </ProcessLine>
      ) : (
        <ProcessLine icon={WarningCircle} className="text-destructive">
          {labels.couldNotComplete}
        </ProcessLine>
      );
    }
    return labels.lookups[name] ? (
      <ProcessLine icon={lookupIcons[name] ?? MagnifyingGlass}>
        {labels.lookups[name]}
      </ProcessLine>
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
    <div className="flex max-w-full flex-wrap items-center gap-1.5 text-caption text-muted-foreground">
      <span>{label} </span>
      <ol className="flex min-w-0 flex-wrap gap-1.5">
        {passages.map((passage) => (
          <li
            key={passage.source}
            className="flex max-w-full min-w-0 gap-1 rounded-full bg-muted px-2 py-0.5 text-secondary-foreground"
          >
            <span className="shrink-0">[{passage.source}] </span>
            <span
              dir="auto"
              lang={languageOfText(passage.title)}
              className="truncate"
            >
              {passage.title}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Three dots in an assistant bubble while a reply is on its way. Seen, not read: the chat's
 * status line says it to screen readers. */
function Typing() {
  return (
    <div
      aria-hidden="true"
      className="flex gap-1 justify-self-start rounded-bubble rounded-es-bubble-tail bg-muted px-3.5 py-3"
    >
      {[0, 150, 300].map((delay) => (
        <span
          key={delay}
          className="size-1.5 rounded-full bg-muted-foreground motion-safe:animate-typing"
          style={{ animationDelay: `${delay}ms` }}
        />
      ))}
    </div>
  );
}

/** A message's arrival: it fades in and rises 4px, unless the visitor prefers less motion. */
const arrives = "motion-safe:animate-arrive";

export function ChatMessages({
  messages,
  labels,
  replying = false,
  onAnswer,
}: {
  messages: UIMessage[];
  labels: ChatLabels;
  /** Whether a reply is on its way: shows the typing dots until its first words arrive. */
  replying?: boolean;
  onAnswer: (id: string, approved: boolean) => void;
}) {
  const last = messages.at(-1);
  const writing =
    last?.role === "assistant" && last.parts.at(-1)?.type === "text";
  return (
    <>
      {messages.map((message, index) => {
        // A reply with nothing in it yet (or none at all, while a person has the conversation).
        if (message.parts.length === 0) return null;
        // Keyed by position: the server gives a message its own id once a turn ends, and a new
        // key would replay its arrival.
        const key = index;
        const fromStaff =
          (message.metadata as { from?: string } | undefined)?.from === "staff";

        if (message.role === "user") {
          return (
            <div
              key={key}
              className={cn(
                "grid max-w-[85%] justify-self-end rounded-bubble rounded-ee-bubble-tail bg-primary px-3.5 py-2 text-body text-primary-foreground",
                arrives,
              )}
            >
              <span className="sr-only">{labels.you}</span>
              {message.parts.map((part, partIndex) =>
                part.type === "text" ? (
                  <Typed key={partIndex} text={part.text} />
                ) : null,
              )}
            </div>
          );
        }

        if (fromStaff) {
          return (
            <div
              key={key}
              className={cn(
                "grid max-w-[88%] gap-1 justify-self-start rounded-bubble rounded-es-bubble-tail bg-card px-3.5 py-2 text-body shadow-[inset_3px_0_0_var(--hala-accent),var(--hala-shadow-1)] rtl:shadow-[inset_-3px_0_0_var(--hala-accent),var(--hala-shadow-1)]",
                arrives,
              )}
            >
              <span className="sr-only">{labels.assistant}</span>
              <span className="flex items-center gap-1 text-caption font-medium text-accent-foreground">
                <UserCircle size={14} aria-hidden="true" />
                {labels.team}
              </span>
              {message.parts.map((part, partIndex) =>
                part.type === "text" ? (
                  <Typed key={partIndex} text={part.text} />
                ) : null,
              )}
            </div>
          );
        }

        const toolParts = message.parts.filter(isToolUIPart) as ToolPart[];
        return (
          <div
            key={key}
            className={cn(
              "grid max-w-[92%] justify-items-start gap-1.5 justify-self-start",
              arrives,
            )}
          >
            <span className="sr-only">{labels.assistant}</span>
            {message.parts.map((part, partIndex) => {
              if (part.type === "text") {
                return (
                  <div
                    key={partIndex}
                    className="max-w-full rounded-bubble rounded-es-bubble-tail bg-muted px-3.5 py-2 text-body"
                  >
                    <Reply text={part.text} />
                  </div>
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
      })}
      {replying && !writing && <Typing />}
    </>
  );
}
