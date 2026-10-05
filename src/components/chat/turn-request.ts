import { isToolUIPart, type UIMessage } from "ai";

/** What the browser sends for a turn: the new message, or the answers to approval requests. */
export function turnRequestBody(messages: UIMessage[]) {
  const last = messages.at(-1);
  if (last?.role === "user") {
    return {
      text: last.parts
        .map((part) => (part.type === "text" ? part.text : ""))
        .join(""),
    };
  }
  return {
    approvals: (last?.parts ?? []).flatMap((part) =>
      isToolUIPart(part) && part.state === "approval-responded"
        ? [{ id: part.approval.id, approved: part.approval.approved }]
        : [],
    ),
  };
}
