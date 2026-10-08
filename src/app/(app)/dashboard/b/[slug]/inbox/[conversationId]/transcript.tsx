import { getToolName, isToolUIPart, type UIMessage } from "ai";
import { Reply, Typed } from "@/components/chat/chat-messages";
import { cn } from "@/lib/utils";

// The whole conversation as the team sees it: the customer's messages, the assistant's replies and
// the team's, and every step the assistant took (each tool, what it was asked, what came back),
// so a person taking over knows exactly what the customer was told and what was done.

type ToolPart = Extract<
  UIMessage["parts"][number],
  { toolCallId: string; state: string }
>;

const toolLabels: Record<string, string> = {
  search_knowledge: "Searched the knowledge base",
  business_info: "Read the business's details",
  check_availability: "Checked availability",
  book_appointment: "Booking",
  find_bookings: "Looked up the customer's bookings",
  reschedule_booking: "Moving a booking",
  cancel_booking: "Cancelling a booking",
  request_human: "Asked for a person",
};

function stateOf(part: ToolPart) {
  const approval = "approval" in part ? part.approval : undefined;
  switch (part.state) {
    case "approval-requested":
      return "waiting for the customer to confirm";
    case "approval-responded":
      return approval?.approved ? "confirmed, running" : "declined";
    case "output-denied":
      return approval?.isAutomatic
        ? "refused by the rules"
        : "declined by the customer";
    case "output-error":
      return "failed";
    case "output-available":
      return (part.output as { ok?: boolean } | null)?.ok === false
        ? "refused"
        : "done";
    default:
      return "running";
  }
}

function Json({ label, value }: { label: string; value: unknown }) {
  return (
    <div className="grid gap-1">
      <p className="font-medium">{label}</p>
      <pre
        dir="ltr"
        className="overflow-x-auto rounded-control bg-card p-2 font-mono break-all whitespace-pre-wrap"
      >
        {JSON.stringify(value, null, 2)}
      </pre>
    </div>
  );
}

function ToolStep({ part }: { part: ToolPart }) {
  const name = getToolName(part as Parameters<typeof getToolName>[0]);
  const approval = "approval" in part ? part.approval : undefined;
  return (
    <details className="rounded-control bg-muted px-3 py-2 text-caption">
      <summary className="cursor-pointer text-secondary-foreground">
        {toolLabels[name] ?? name}: {stateOf(part)}
      </summary>
      <div className="mt-2 grid gap-2">
        {"input" in part && <Json label="Asked with" value={part.input} />}
        {approval?.requestReason && (
          <div className="grid gap-1">
            <p className="font-medium">Asked the customer to confirm</p>
            <Typed text={approval.requestReason} />
          </div>
        )}
        {approval?.reason && (
          <div className="grid gap-1">
            <p className="font-medium">
              {approval.isAutomatic
                ? "Refused before asking, because"
                : "The customer's answer"}
            </p>
            <Typed text={approval.reason} />
          </div>
        )}
        {"output" in part && part.output !== undefined && (
          <Json label="Result" value={part.output} />
        )}
        {"errorText" in part && part.errorText && (
          <p className="text-destructive">{part.errorText}</p>
        )}
      </div>
    </details>
  );
}

export function Transcript({
  messages,
}: {
  messages: { message: UIMessage; sender: string | null }[];
}) {
  const shown = messages.filter(({ message }) => message.parts.length > 0);
  if (shown.length === 0) {
    return <p className="text-secondary-foreground">No messages yet.</p>;
  }
  return (
    // As a thread from the team's side: the customer at the start, the assistant and the team at
    // the end, each in their own bubble, with the steps the assistant took under its words.
    <ol className="grid grid-cols-[minmax(0,1fr)] gap-4">
      {shown.map(({ message, sender }) => {
        const fromStaff =
          (message.metadata as { from?: string } | undefined)?.from === "staff";
        const fromCustomer = message.role === "user";
        return (
          <li
            key={message.id}
            className={cn(
              "grid max-w-[88%] gap-1.5",
              fromCustomer
                ? "justify-items-start justify-self-start"
                : "justify-items-end justify-self-end",
            )}
          >
            <p className="px-1 text-caption font-medium text-muted-foreground">
              {message.role === "user" ? (
                "Customer"
              ) : fromStaff ? (
                <>
                  Team
                  {sender && (
                    <>
                      {" · "}
                      <span dir="auto">{sender}</span>
                    </>
                  )}
                </>
              ) : (
                "Assistant"
              )}
            </p>
            {message.parts.map((part, index) => {
              if (part.type === "text") {
                return (
                  <div
                    key={index}
                    className={cn(
                      "max-w-full rounded-bubble px-3.5 py-2.5",
                      fromCustomer
                        ? "rounded-es-bubble-tail bg-muted"
                        : fromStaff
                          ? "rounded-ee-bubble-tail bg-accent"
                          : "rounded-ee-bubble-tail bg-card shadow-level-1",
                    )}
                  >
                    {message.role === "assistant" && !fromStaff ? (
                      <Reply text={part.text} />
                    ) : (
                      <Typed text={part.text} />
                    )}
                  </div>
                );
              }
              if (isToolUIPart(part)) {
                return (
                  <ToolStep key={part.toolCallId} part={part as ToolPart} />
                );
              }
              return null;
            })}
          </li>
        );
      })}
    </ol>
  );
}
