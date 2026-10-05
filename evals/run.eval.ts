import { mkdirSync, writeFileSync } from "node:fs";
import { isToolUIPart, type UIMessage } from "ai";
import { it } from "vitest";
import { chatModelId } from "@/lib/ai/chat-model";
import { runAssistantTurn, type TurnInput } from "@/lib/assistant/turn";
import {
  serviceClient,
  startConversation,
  toolCallsOf,
} from "../integration/support";
import { CASES, type EvalCase } from "./cases";
import { type CheckResult, runChecks } from "./checks";
import { judge, transcriptOf, type Verdict, verdictPassed } from "./judge";
import { createEvalSalon, type EvalSalon } from "./salon";

// Runs every case (or EVAL_CASES=id,id) against the assistant as configured in .env.local, one
// at a time, and writes a report to evals/reports/. It stops starting new cases once the run has
// spent EVAL_BUDGET_USD (default $1.50: the AI Gateway's free credit is $5 a month). The judge
// is EVAL_JUDGE_MODEL (default Claude Haiku; "off" skips it, and it's off for the offline model).

const BUDGET_USD = Number(process.env.EVAL_BUDGET_USD ?? "1.5");
const ONLY = process.env.EVAL_CASES?.split(",")
  .map((id) => id.trim())
  .filter(Boolean);

type CaseResult = {
  id: string;
  category: EvalCase["category"];
  checks: CheckResult[];
  verdict: Verdict | null;
  passed: boolean;
  costUsd: number;
  error: string | null;
  transcript: string;
};

async function storedMessages(conversationId: string) {
  // The reply is saved when its stream ends; give that a moment.
  for (let attempt = 0; attempt < 60; attempt += 1) {
    const { data, error } = await serviceClient()
      .from("conversation_messages")
      .select("message")
      .eq("conversation_id", conversationId)
      .order("position");
    if (error) throw error;
    const messages = data.map((row) => row.message as unknown as UIMessage);
    if (messages.at(-1)?.role === "assistant") return messages;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  throw new Error("The assistant's reply was never saved");
}

/** Confirmation cards still waiting for the customer's answer. */
function pendingApprovals(messages: UIMessage[]) {
  return messages.flatMap((message) =>
    message.parts.flatMap((part) =>
      isToolUIPart(part) &&
      part.state === "approval-requested" &&
      !part.approval.isAutomatic
        ? [part.approval.id]
        : [],
    ),
  );
}

/** The error a streamed reply carried, if any (the gateway's refusals arrive this way). */
function streamError(body: string) {
  const match = /"type":"error","errorText":"((?:[^"\\]|\\.)*)"/.exec(body);
  return match ? JSON.parse(`"${match[1]}"`) : null;
}

async function conversationCost(conversationId: string) {
  const { data, error } = await serviceClient()
    .from("model_calls")
    .select("cost_usd")
    .eq("conversation_id", conversationId);
  if (error) throw error;
  return data.reduce((sum, row) => sum + row.cost_usd, 0);
}

/** A failure worth one retry: the gateway's rate limits and hiccups, not the model's answer. */
function isTransient(error: string | null) {
  return (
    error !== null &&
    /something went wrong|HTTP (429|5\d\d)|rate limit|fetch failed/i.test(error)
  );
}

async function runCase(
  salon: EvalSalon,
  evalCase: EvalCase,
  judgeModel: string,
): Promise<CaseResult> {
  const first = await attemptCase(salon, evalCase, judgeModel);
  if (!isTransient(first.error)) return first;
  // The free tier's per-model rate limits clear within seconds.
  await new Promise((resolve) => setTimeout(resolve, 20_000));
  const second = await attemptCase(salon, evalCase, judgeModel);
  return { ...second, costUsd: second.costUsd + first.costUsd };
}

async function attemptCase(
  salon: EvalSalon,
  evalCase: EvalCase,
  judgeModel: string,
): Promise<CaseResult> {
  const conversationId = await startConversation(salon.business.id);
  let error: string | null = null;
  try {
    for (const turn of evalCase.turns(salon)) {
      let input: TurnInput;
      if (typeof turn === "string") {
        input = { text: turn };
      } else {
        const pending = pendingApprovals(await storedMessages(conversationId));
        if (pending.length === 0) break;
        input = {
          approvals: pending.map((id) => ({ id, approved: turn.approve })),
        };
      }
      const response = await runAssistantTurn({ conversationId, input });
      const body = await response.text();
      error = response.ok ? streamError(body) : `HTTP ${response.status}`;
      if (error) break;
      await storedMessages(conversationId);
    }
  } catch (thrown) {
    error = thrown instanceof Error ? thrown.message : String(thrown);
  }

  const { data: conversation } = await serviceClient()
    .from("conversations")
    .select("status")
    .eq("id", conversationId)
    .single();
  const { data: rows } = await serviceClient()
    .from("conversation_messages")
    .select("message")
    .eq("conversation_id", conversationId)
    .order("position");
  const messages = (rows ?? []).map(
    (row) => row.message as unknown as UIMessage,
  );
  // A tool that failed on the gateway's rate limit (a search's embedding call, say) is as
  // transient as a failed turn.
  const failedTool = messages
    .flatMap((message) => message.parts)
    .find(
      (part) =>
        isToolUIPart(part) &&
        "errorText" in part &&
        isTransient(part.errorText ?? null),
    );
  if (!error && failedTool && "errorText" in failedTool) {
    error = `A tool failed: ${failedTool.errorText}`;
  }
  const checks = runChecks(evalCase.expect, {
    messages,
    toolCalls: await toolCallsOf(conversationId),
    status: conversation?.status ?? "open",
  });

  let costUsd = await conversationCost(conversationId);
  let verdict: Verdict | null = null;
  if (judgeModel !== "off" && !error) {
    try {
      const judged = await judge(judgeModel, evalCase.rubric, messages);
      verdict = judged.verdict;
      costUsd += judged.costUsd;
    } catch (thrown) {
      error = `Judge failed: ${thrown instanceof Error ? thrown.message : String(thrown)}`;
    }
  }

  return {
    id: evalCase.id,
    category: evalCase.category,
    checks,
    verdict,
    passed:
      !error &&
      checks.every((check) => check.passed) &&
      (verdict === null || verdictPassed(verdict)),
    costUsd,
    error,
    transcript: transcriptOf(messages),
  };
}

function report(
  results: CaseResult[],
  skipped: string[],
  setupCostUsd: number,
  models: { chat: string; embedding: string; judge: string },
) {
  const spent =
    setupCostUsd + results.reduce((sum, result) => sum + result.costUsd, 0);
  const passed = results.filter((result) => result.passed).length;
  const checks = results.flatMap((result) => result.checks);
  const lines = [
    `# Evaluation, ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`,
    "",
    `Chat model: \`${models.chat}\` · embeddings: \`${models.embedding}\` · judge: \`${models.judge}\``,
    "",
    `**${passed} of ${results.length} cases passed** · checks ${checks.filter((check) => check.passed).length}/${checks.length} · spent $${spent.toFixed(4)} of a $${BUDGET_USD.toFixed(2)} budget (setup $${setupCostUsd.toFixed(4)})`,
    ...(skipped.length
      ? ["", `Not run (budget reached): ${skipped.join(", ")}`]
      : []),
    "",
    "| Case | Category | Checks | Judge | Cost |",
    "| --- | --- | --- | --- | --- |",
    ...results.map(
      (result) =>
        `| ${result.passed ? "✅" : "❌"} ${result.id} | ${result.category} | ${result.checks.filter((check) => check.passed).length}/${result.checks.length} | ${result.verdict ? (verdictPassed(result.verdict) ? "pass" : "fail") : "–"} | $${result.costUsd.toFixed(4)} |`,
    ),
    "",
    "## Details",
    ...results.flatMap((result) => [
      "",
      `### ${result.passed ? "✅" : "❌"} ${result.id}`,
      "",
      ...(result.error ? [`**Error:** ${result.error}`] : []),
      ...result.checks
        .filter((check) => !check.passed)
        .map((check) => `- Failed check: ${check.check}`),
      ...(result.verdict ? [`- Judge: ${result.verdict.reason}`] : []),
      "",
      "```text",
      result.transcript,
      "```",
    ]),
  ];
  return { markdown: lines.join("\n"), passed, spent };
}

it("runs the evaluation and writes a report", async () => {
  const chat = chatModelId();
  const judgeModel =
    process.env.EVAL_JUDGE_MODEL ??
    (chat === "offline" ? "off" : "anthropic/claude-haiku-4.5");
  const cases = ONLY
    ? CASES.filter((evalCase) => ONLY.includes(evalCase.id))
    : CASES;

  const salon = await createEvalSalon();
  const { data: setupCalls, error } = await serviceClient()
    .from("model_calls")
    .select("cost_usd")
    .eq("business_id", salon.business.id);
  if (error) throw error;
  const setupCostUsd = setupCalls.reduce((sum, row) => sum + row.cost_usd, 0);

  const results: CaseResult[] = [];
  const skipped: string[] = [];
  let spent = setupCostUsd;
  for (const evalCase of cases) {
    if (spent >= BUDGET_USD) {
      skipped.push(evalCase.id);
      continue;
    }
    // A short pause between cases keeps the free tier's per-model rate limits clear.
    if (results.length > 0) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
    }
    const result = await runCase(salon, evalCase, judgeModel);
    spent += result.costUsd;
    results.push(result);
    process.stdout.write(
      `${result.passed ? "PASS" : "FAIL"} ${result.id} ($${result.costUsd.toFixed(4)})${result.error ? ` ${result.error}` : ""}\n`,
    );
  }

  const models = {
    chat,
    embedding: process.env.EMBEDDING_MODEL ?? "unset",
    judge: judgeModel,
  };
  const { markdown, passed } = report(results, skipped, setupCostUsd, models);
  mkdirSync("evals/reports", { recursive: true });
  const name = `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}-${chat.replace(/\W+/g, "-")}`;
  writeFileSync(`evals/reports/${name}.md`, markdown);
  writeFileSync(
    `evals/reports/${name}.json`,
    JSON.stringify({ models, setupCostUsd, results, skipped }, null, 2),
  );
  process.stdout.write(
    `\n${passed} of ${results.length} cases passed, $${spent.toFixed(4)} spent. Report: evals/reports/${name}.md\n`,
  );
});
