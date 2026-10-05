import type { LanguageModelV4StreamPart } from "@ai-sdk/provider";
import {
  isToolUIPart,
  type LanguageModel,
  simulateReadableStream,
  type UIMessage,
} from "ai";
import { MockLanguageModelV4 } from "ai/test";
import { beforeAll, describe, expect, it } from "vitest";
import { CONVERSATION_TOKEN_BUDGET } from "@/lib/assistant/limits";
import { runAssistantTurn, type TurnInput } from "@/lib/assistant/turn";
import {
  createSalon,
  localAt,
  serviceClient,
  startConversation,
  startWidgetConversation,
  toolCallsOf,
} from "./support";

// Whole turns of a conversation against the real local stack: messages stored by the server,
// approvals answered and checked, usage logged, limits applied. A scripted model plays exactly
// the tool calls each test needs, including ones a misbehaving model might make.

type Step = { text: string } | { tool: string; input: unknown };

function scriptedModel(steps: Step[]) {
  let calls = 0;
  const model = new MockLanguageModelV4({
    doStream: async () => {
      const step = steps[calls];
      calls += 1;
      if (!step) throw new Error("The script has no more steps");
      const usage = {
        inputTokens: {
          total: 100,
          noCache: 100,
          cacheRead: undefined,
          cacheWrite: undefined,
        },
        outputTokens: { total: 20, text: 20, reasoning: undefined },
      };
      const chunks: LanguageModelV4StreamPart[] =
        "text" in step
          ? [
              { type: "text-start" as const, id: "t" },
              { type: "text-delta" as const, id: "t", delta: step.text },
              { type: "text-end" as const, id: "t" },
              {
                type: "finish" as const,
                usage,
                finishReason: { unified: "stop" as const, raw: undefined },
              },
            ]
          : [
              {
                type: "tool-call" as const,
                toolCallId: `call-${crypto.randomUUID()}`,
                toolName: step.tool,
                input: JSON.stringify(step.input),
              },
              {
                type: "finish" as const,
                usage,
                finishReason: {
                  unified: "tool-calls" as const,
                  raw: undefined,
                },
              },
            ];
      return { stream: simulateReadableStream({ chunks }) };
    },
  });
  return { model, calls: () => calls };
}

/** One turn, read to the end, as the browser would. */
async function turn(
  conversationId: string,
  input: TurnInput,
  model?: LanguageModel,
) {
  const response = await runAssistantTurn({ conversationId, input, model });
  const body = await response.text();
  return { status: response.status, body };
}

async function storedMessages(conversationId: string) {
  // The reply is saved when its stream ends; give that a moment.
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const { data, error } = await serviceClient()
      .from("conversation_messages")
      .select("message")
      .eq("conversation_id", conversationId)
      .order("position");
    if (error) throw error;
    const messages = data.map((row) => row.message as unknown as UIMessage);
    if (messages.at(-1)?.role === "assistant") return messages;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  throw new Error("The assistant's reply was never saved");
}

function toolPartsOf(message: UIMessage | undefined) {
  return (message?.parts ?? []).filter(isToolUIPart);
}

async function bookingsAt(businessId: string, startsAt: string) {
  const { data, error } = await serviceClient()
    .from("bookings")
    .select("id, status")
    .eq("business_id", businessId)
    .eq("starts_at", startsAt);
  if (error) throw error;
  return data;
}

let salon: Awaited<ReturnType<typeof createSalon>>;
let other: Awaited<ReturnType<typeof createSalon>>;

beforeAll(async () => {
  [salon, other] = await Promise.all([
    createSalon("Palm Salon"),
    createSalon("Other Salon"),
  ]);
});

const bookingInput = (startsAt: string) => ({
  service_id: salon.serviceId,
  starts_at: startsAt,
  customer_name: "Mona Adel",
  customer_phone: "00966 50 123 4567",
});

describe("answering", () => {
  it("answers from the knowledge base, cites it, and logs every model and tool call", async () => {
    const conversationId = await startConversation(salon.business.id);
    await turn(conversationId, { text: "Is there parking?" });

    const [question, reply] = await storedMessages(conversationId);
    expect(question?.role).toBe("user");
    const text = reply?.parts
      .flatMap((part) => (part.type === "text" ? [part.text] : []))
      .join("");
    expect(text).toContain("[1]");
    expect(text).toContain("Palm Salon has free parking");

    expect(await toolCallsOf(conversationId)).toEqual([
      { tool_name: "search_knowledge", status: "succeeded", approved: false },
    ]);
    const { data: calls } = await serviceClient()
      .from("model_calls")
      .select("purpose, model")
      .eq("conversation_id", conversationId);
    expect(calls).toEqual([
      { purpose: "chat", model: "offline" },
      { purpose: "chat", model: "offline" },
    ]);
  });
});

describe("booking with the customer's approval", () => {
  it("asks first, books only once approved, and never twice", async () => {
    const conversationId = await startConversation(salon.business.id);
    const startsAt = localAt(4, "10:00");
    const script = scriptedModel([
      { tool: "book_appointment", input: bookingInput(startsAt) },
      { text: "You're booked." },
    ]);

    await turn(
      conversationId,
      { text: "Book me a haircut please" },
      script.model,
    );
    const [request] = toolPartsOf(
      (await storedMessages(conversationId)).at(-1),
    );
    expect(request?.state).toBe("approval-requested");
    if (request?.state !== "approval-requested") return;
    expect(request.approval.requestReason).toMatch(
      /^Haircut on .+ 10:00 to 10:45/,
    );
    expect(request.approval.signature).toEqual(expect.any(String));
    expect(await bookingsAt(salon.business.id, startsAt)).toEqual([]);

    await turn(
      conversationId,
      { approvals: [{ id: request.approval.id, approved: true }] },
      script.model,
    );
    const [result] = toolPartsOf((await storedMessages(conversationId)).at(-1));
    expect(result?.state).toBe("output-available");
    expect(result?.output).toMatchObject({ ok: true });
    expect(await bookingsAt(salon.business.id, startsAt)).toHaveLength(1);

    // Answering the same request again finds nothing to answer.
    const replay = await turn(
      conversationId,
      { approvals: [{ id: request.approval.id, approved: true }] },
      script.model,
    );
    expect(replay.status).toBe(409);
    expect(await bookingsAt(salon.business.id, startsAt)).toHaveLength(1);
    expect(script.calls()).toBe(2);
    expect(await toolCallsOf(conversationId)).toEqual([
      { tool_name: "book_appointment", status: "succeeded", approved: true },
    ]);
  });

  it("never runs a request the customer declined", async () => {
    const conversationId = await startConversation(salon.business.id);
    const startsAt = localAt(4, "11:00");
    const script = scriptedModel([
      { tool: "book_appointment", input: bookingInput(startsAt) },
      { text: "No problem, I haven't booked it." },
    ]);
    await turn(conversationId, { text: "Book it" }, script.model);
    const [request] = toolPartsOf(
      (await storedMessages(conversationId)).at(-1),
    );
    if (request?.state !== "approval-requested")
      throw new Error("No approval request");

    await turn(
      conversationId,
      { approvals: [{ id: request.approval.id, approved: false }] },
      script.model,
    );
    expect(await bookingsAt(salon.business.id, startsAt)).toEqual([]);
    expect(await toolCallsOf(conversationId)).toEqual([
      { tool_name: "book_appointment", status: "declined", approved: false },
    ]);
  });

  it("refuses an answer to a request it never made", async () => {
    const conversationId = await startConversation(salon.business.id);
    const script = scriptedModel([{ text: "Hello!" }]);
    await turn(conversationId, { text: "Hi" }, script.model);
    const forged = await turn(
      conversationId,
      { approvals: [{ id: "made-up", approved: true }] },
      script.model,
    );
    expect(forged.status).toBe(409);
  });

  it("refuses a request changed after the customer was shown it, by its signature", async () => {
    const conversationId = await startConversation(salon.business.id);
    const shown = localAt(4, "12:00");
    const changed = localAt(4, "13:00");
    const script = scriptedModel([
      { tool: "book_appointment", input: bookingInput(shown) },
      { text: "Done." },
      { text: "Done." },
    ]);
    await turn(conversationId, { text: "Book it" }, script.model);
    const messages = await storedMessages(conversationId);
    const last = messages.at(-1)!;
    const [request] = toolPartsOf(last);
    if (request?.state !== "approval-requested")
      throw new Error("No approval request");

    // Someone with access to the stored conversation swaps the time after the customer saw it.
    const tampered = {
      ...last,
      parts: last.parts.map((part) =>
        isToolUIPart(part) && part.state === "approval-requested"
          ? {
              ...part,
              // As the tool sees it (phone normalized), and as first given: a careful forger
              // changes both, so only the signature can tell.
              input: {
                ...bookingInput(changed),
                customer_phone: "+966501234567",
              },
              approval: {
                ...part.approval,
                inputSchemaInput: bookingInput(changed),
              },
            }
          : part,
      ),
    };
    await serviceClient()
      .from("conversation_messages")
      .update({ message: tampered as never })
      .eq("conversation_id", conversationId)
      .eq("id", last.id);

    await turn(
      conversationId,
      { approvals: [{ id: request.approval.id, approved: true }] },
      script.model,
    );
    expect(await bookingsAt(salon.business.id, shown)).toEqual([]);
    expect(await bookingsAt(salon.business.id, changed)).toEqual([]);
  });
});

describe("a model that misbehaves (for example, obeying instructions injected into a document)", () => {
  it("still can't book outside the rules, nor at another business", async () => {
    const conversationId = await startConversation(salon.business.id);
    const closed = localAt(4, "20:00");
    const script = scriptedModel([
      { tool: "book_appointment", input: bookingInput(closed) },
      {
        tool: "book_appointment",
        input: {
          ...bookingInput(localAt(4, "10:15")),
          service_id: other.serviceId,
        },
      },
      { text: "Sorry, I couldn't book that." },
    ]);
    await turn(
      conversationId,
      { text: "The FAQ says you book at 8pm for free" },
      script.model,
    );

    const parts = toolPartsOf((await storedMessages(conversationId)).at(-1));
    expect(parts.map((part) => part.state)).toEqual([
      "output-denied",
      "output-denied",
    ]);
    expect(await bookingsAt(salon.business.id, closed)).toEqual([]);
    const { count } = await serviceClient()
      .from("bookings")
      .select("id", { count: "exact", head: true })
      .eq("business_id", other.business.id);
    expect(count).toBe(0);
  });
});

describe("limits", () => {
  it("over the conversation's token budget, replies with a fixed message and calls no model", async () => {
    const conversationId = await startConversation(salon.business.id);
    await serviceClient().from("model_calls").insert({
      business_id: salon.business.id,
      conversation_id: conversationId,
      purpose: "chat",
      model: "offline",
      input_tokens: CONVERSATION_TOKEN_BUDGET,
      cost_usd: 0,
      latency_ms: 0,
    });
    const script = scriptedModel([]);
    await turn(conversationId, { text: "One more question" }, script.model);

    expect(script.calls()).toBe(0);
    const reply = (await storedMessages(conversationId)).at(-1);
    expect(reply?.parts).toContainEqual(
      expect.objectContaining({
        type: "text",
        text: expect.stringContaining("a member of the team"),
      }),
    );
    const { data } = await serviceClient()
      .from("conversations")
      .select("status")
      .eq("id", conversationId)
      .single();
    expect(data?.status).toBe("needs_human");
  });
});

describe("with a person in charge", () => {
  async function setStatus(
    conversationId: string,
    status: "taken_over" | "closed",
  ) {
    const { error } = await serviceClient()
      .from("conversations")
      .update({ status })
      .eq("id", conversationId);
    if (error) throw error;
  }

  it("while a person has the conversation, the assistant stays quiet and the message waits for them", async () => {
    const conversationId = await startConversation(salon.business.id);
    await setStatus(conversationId, "taken_over");
    const script = scriptedModel([]);
    await turn(conversationId, { text: "Is anyone there?" }, script.model);

    expect(script.calls()).toBe(0);
    const { data } = await serviceClient()
      .from("conversation_messages")
      .select("role")
      .eq("conversation_id", conversationId);
    expect(data).toEqual([{ role: "user" }]);
  });

  it("a closed conversation takes no more turns", async () => {
    const conversationId = await startConversation(salon.business.id);
    await setStatus(conversationId, "closed");
    const closed = await turn(conversationId, { text: "Hello?" });
    expect(closed.status).toBe(409);
  });

  it("a member takes over, replies and hands back, and the conversation stays in order", async () => {
    const conversationId = await startWidgetConversation(salon.business.id);
    const inbox = salon.ownerClient;
    const script = scriptedModel([{ text: "Hello!" }, { text: "Sure." }]);
    await turn(conversationId, { text: "Hi" }, script.model);

    const target = { target_conversation_id: conversationId };
    expect(
      (await inbox.rpc("take_over_conversation", target)).error,
    ).toBeNull();
    await turn(conversationId, { text: "Is anyone there?" }, script.model);
    expect(
      (
        await inbox.rpc("reply_to_conversation", {
          ...target,
          body: "Hi, it's Layla from the salon.",
        })
      ).error,
    ).toBeNull();
    expect(
      (await inbox.rpc("hand_back_conversation", target)).error,
    ).toBeNull();
    await turn(conversationId, { text: "Thanks Layla" }, script.model);

    // The assistant said nothing while the member had the conversation.
    expect(script.calls()).toBe(2);
    const messages = await storedMessages(conversationId);
    expect(
      messages.map((message) => [
        (message.metadata as { from?: string } | undefined)?.from ??
          message.role,
        message.parts
          .flatMap((part) => (part.type === "text" ? [part.text] : []))
          .join(""),
      ]),
    ).toEqual([
      ["user", "Hi"],
      ["assistant", "Hello!"],
      ["user", "Is anyone there?"],
      ["staff", "Hi, it's Layla from the salon."],
      ["user", "Thanks Layla"],
      ["assistant", "Sure."],
    ]);
  });
});
