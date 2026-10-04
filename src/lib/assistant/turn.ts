import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  createAgentUIStreamResponse,
  createUIMessageStream,
  createUIMessageStreamResponse,
  generateId,
  getToolName,
  isStepCount,
  isToolUIPart,
  type LanguageModel,
  ToolLoopAgent,
  type UIMessage,
} from "ai";
import { chatCostUsd } from "@/lib/ai/catalog";
import {
  chatModel,
  chatModelId,
  toolApprovalSecret,
} from "@/lib/ai/chat-model";
import { instructionsFor } from "@/lib/assistant/instructions";
import {
  handsOver,
  limitMessage,
  limitReached,
  MAX_STEPS_PER_TURN,
} from "@/lib/assistant/limits";
import { languageOfText } from "@/lib/assistant/language";
import {
  type AssistantContext,
  createAssistantToolkit,
} from "@/lib/assistant/toolkit";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";

// One turn of a conversation: the customer's new message, or their answers to approval
// requests, in; the assistant's reply streamed out. The conversation lives in the database: the
// browser never sends history, so it can't rewrite what was said or invent an approval. It can
// only add a message, or approve or decline a request the server itself stored, and approvals are
// signed (TOOL_APPROVAL_SECRET) so they only run exactly what the customer was shown.

export type TurnInput =
  { text: string } | { approvals: { id: string; approved: boolean }[] };

type Client = SupabaseClient<Database>;

async function loadConversation(supabase: Client, conversationId: string) {
  const { data, error } = await supabase
    .from("conversations")
    .select(
      "id, business_id, businesses (id, name, timezone, default_language, booking_notice_minutes, booking_horizon_days, cancellation_notice_hours)",
    )
    .eq("id", conversationId)
    .single();
  if (error)
    throw new Error(`Could not load the conversation: ${error.message}`);
  return data;
}

async function loadMessages(supabase: Client, conversationId: string) {
  const { data, error } = await supabase
    .from("conversation_messages")
    .select("message")
    .eq("conversation_id", conversationId)
    .order("position");
  if (error) throw new Error(`Could not load the messages: ${error.message}`);
  return data.map((row) => row.message as unknown as UIMessage);
}

async function saveMessages(
  supabase: Client,
  conversation: { id: string; business_id: string },
  messages: UIMessage[],
) {
  const now = new Date().toISOString();
  const { error } = await supabase.from("conversation_messages").upsert(
    messages.map((message, position) => ({
      conversation_id: conversation.id,
      business_id: conversation.business_id,
      id: message.id,
      position,
      role: message.role as "user" | "assistant",
      message: message as never,
      updated_at: now,
    })),
  );
  if (error) throw new Error(`Could not save the messages: ${error.message}`);
  const { error: touchError } = await supabase
    .from("conversations")
    .update({ updated_at: now })
    .eq("id", conversation.id);
  if (touchError) {
    throw new Error(`Could not update the conversation: ${touchError.message}`);
  }
}

/**
 * Applies the customer's answers to the approval requests in the last assistant message: only
 * to requests the server stored, keeping their server-issued signatures. Returns the updated
 * messages and the calls the customer declined, or null when no answer matched a request.
 */
function applyApprovals(
  messages: UIMessage[],
  answers: { id: string; approved: boolean }[],
) {
  const last = messages.at(-1);
  if (last?.role !== "assistant") return null;
  const declined: { toolCallId: string; toolName: string; input: unknown }[] =
    [];
  let applied = 0;
  const parts = last.parts.map((part) => {
    if (!isToolUIPart(part) || part.state !== "approval-requested") return part;
    const answer = answers.find(
      (candidate) => candidate.id === part.approval.id,
    );
    if (!answer) return part;
    applied += 1;
    if (!answer.approved) {
      declined.push({
        toolCallId: part.toolCallId,
        toolName: getToolName(part),
        input: part.input,
      });
    }
    return {
      ...part,
      state: "approval-responded" as const,
      approval: { ...part.approval, approved: answer.approved },
    };
  });
  if (applied === 0) return null;
  return { messages: [...messages.slice(0, -1), { ...last, parts }], declined };
}

function latestUserText(messages: UIMessage[]) {
  const latest = messages.findLast((message) => message.role === "user");
  return (latest?.parts ?? [])
    .map((part) => (part.type === "text" ? part.text : ""))
    .join(" ");
}

/** A fixed reply, streamed like the assistant's, for when no model may be called. */
function fixedReply(
  text: string,
  onEnd: (messages: UIMessage[]) => Promise<void>,
  messages: UIMessage[],
) {
  return createUIMessageStreamResponse({
    stream: createUIMessageStream({
      originalMessages: messages,
      generateId,
      execute: ({ writer }) => {
        const id = generateId();
        writer.write({ type: "text-start", id });
        writer.write({ type: "text-delta", id, delta: text });
        writer.write({ type: "text-end", id });
      },
      onEnd: ({ messages: finished }) => onEnd(finished),
    }),
  });
}

export async function runAssistantTurn(options: {
  conversationId: string;
  input: TurnInput;
  abortSignal?: AbortSignal;
  /** Tests replace the model (CHAT_MODEL still names it in the usage log). */
  model?: LanguageModel;
}): Promise<Response> {
  const supabase = createAdminClient();
  const conversation = await loadConversation(supabase, options.conversationId);
  const business = conversation.businesses;
  const context: AssistantContext = {
    supabase,
    business,
    conversationId: conversation.id,
  };
  const toolkit = createAssistantToolkit(context);

  const stored = await loadMessages(supabase, conversation.id);
  let messages: UIMessage[];
  if ("text" in options.input) {
    messages = [
      ...stored,
      {
        id: generateId(),
        role: "user",
        parts: [{ type: "text", text: options.input.text }],
      },
    ];
  } else {
    const applied = applyApprovals(stored, options.input.approvals);
    if (!applied) {
      return Response.json(
        { error: "There is no such request to answer." },
        { status: 409 },
      );
    }
    for (const call of applied.declined) await toolkit.recordDeclined(call);
    messages = applied.messages;
  }
  // Keep what the customer said even if the reply fails.
  await saveMessages(supabase, conversation, messages);
  const save = (finished: UIMessage[]) =>
    saveMessages(supabase, conversation, finished);

  const { data: usage, error: usageError } = await supabase
    .rpc("chat_usage", { target_conversation_id: conversation.id })
    .single();
  if (usageError)
    throw new Error(`Could not check usage: ${usageError.message}`);
  const limit = limitReached(usage);
  if (limit) {
    if (handsOver(limit)) {
      await supabase
        .from("conversations")
        .update({ status: "needs_human" })
        .eq("id", conversation.id);
    }
    return fixedReply(
      limitMessage(limit, languageOfText(latestUserText(messages))),
      save,
      messages,
    );
  }

  const modelId = chatModelId();
  let stepStarted = performance.now();
  const agent = new ToolLoopAgent({
    model: options.model ?? chatModel(modelId),
    instructions: instructionsFor(business, new Date()),
    tools: toolkit.tools,
    toolApproval: toolkit.toolApproval,
    experimental_toolApprovalSecret: toolApprovalSecret(),
    stopWhen: isStepCount(MAX_STEPS_PER_TURN),
    onStepStart: () => {
      stepStarted = performance.now();
    },
    // Every model call, with its tokens, cost and latency, for the budgets and the dashboard.
    onStepEnd: async (step) => {
      const inputTokens = step.usage.inputTokens ?? 0;
      const outputTokens = step.usage.outputTokens ?? 0;
      const { error } = await supabase.from("model_calls").insert({
        business_id: business.id,
        conversation_id: conversation.id,
        purpose: "chat",
        model: modelId,
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        cost_usd: chatCostUsd(modelId, inputTokens, outputTokens),
        latency_ms: Math.round(performance.now() - stepStarted),
      });
      if (error)
        console.error("Recording a model call failed", { code: error.code });
    },
  });

  return createAgentUIStreamResponse({
    agent,
    uiMessages: messages,
    abortSignal: options.abortSignal,
    generateMessageId: generateId,
    onEnd: ({ messages: finished }) => save(finished),
    onError: (error) => {
      console.error("An assistant turn failed", {
        name: error instanceof Error ? error.name : "UnknownError",
      });
      return "Sorry, something went wrong. Please try again.";
    },
  });
}
