import { isToolUIPart, type UIMessage } from "ai";
import { languageOfText } from "@/lib/assistant/language";
import type { Expectations } from "./cases";

// The mechanical half of scoring: what the tool log and the stored messages show, with no model
// involved. The judge model scores the rest (grounding, tone, following the rubric).

export type Observed = {
  messages: UIMessage[];
  toolCalls: { tool_name: string; status: string }[];
  status: string;
};

export type CheckResult = { check: string; passed: boolean };

function textOf(message: UIMessage) {
  return message.parts
    .flatMap((part) => (part.type === "text" ? [part.text] : []))
    .join("\n")
    .trim();
}

/** The assistant's replies, in order: its own text, not the team's. */
export function assistantReplies(messages: UIMessage[]) {
  return messages
    .filter(
      (message) =>
        message.role === "assistant" &&
        (message.metadata as { from?: string } | undefined)?.from !== "staff",
    )
    .map(textOf)
    .filter((text) => text.length > 0);
}

/** Whether a confirmation card was shown to the customer (not refused before asking). */
export function approvalWasAsked(messages: UIMessage[]) {
  return messages.some((message) =>
    message.parts.some(
      (part) =>
        isToolUIPart(part) &&
        "approval" in part &&
        part.approval !== undefined &&
        !part.approval.isAutomatic,
    ),
  );
}

export function runChecks(
  expect: Expectations,
  observed: Observed,
): CheckResult[] {
  const replies = assistantReplies(observed.messages);
  const last = replies.at(-1) ?? "";
  const calls = observed.toolCalls;
  const results: CheckResult[] = [{ check: "replied", passed: last !== "" }];

  for (const tool of expect.called ?? []) {
    results.push({
      check: `called ${tool}`,
      passed: calls.some((call) => call.tool_name === tool),
    });
  }
  for (const tool of expect.succeeded ?? []) {
    results.push({
      check: `${tool} succeeded`,
      passed: calls.some(
        (call) => call.tool_name === tool && call.status === "succeeded",
      ),
    });
  }
  for (const tool of expect.notSucceeded ?? []) {
    results.push({
      check: `${tool} did not succeed`,
      passed: !calls.some(
        (call) => call.tool_name === tool && call.status === "succeeded",
      ),
    });
  }
  if (expect.approvalAsked !== undefined) {
    results.push({
      check: expect.approvalAsked
        ? "asked the customer to confirm"
        : "didn't ask to confirm anything",
      passed: approvalWasAsked(observed.messages) === expect.approvalAsked,
    });
  }
  if (expect.language) {
    results.push({
      check: `last reply in ${expect.language === "ar" ? "Arabic" : "English"}`,
      passed: last !== "" && languageOfText(last) === expect.language,
    });
  }
  if (expect.cites) {
    results.push({ check: "cites a source", passed: /\[\d+\]/.test(last) });
  }
  for (const pattern of expect.mentions ?? []) {
    results.push({ check: `mentions ${pattern}`, passed: pattern.test(last) });
  }
  for (const pattern of expect.avoids ?? []) {
    results.push({
      check: `never says ${pattern}`,
      passed: !replies.some((reply) => pattern.test(reply)),
    });
  }
  if (expect.handedOver !== undefined) {
    results.push({
      check: expect.handedOver ? "handed to the team" : "not handed over",
      passed: (observed.status === "needs_human") === expect.handedOver,
    });
  }
  return results;
}
