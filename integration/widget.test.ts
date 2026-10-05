import { beforeAll, describe, expect, it } from "vitest";
import { POST as chat } from "@/app/api/widget/[slug]/chat/route";
import { POST as start } from "@/app/api/widget/[slug]/conversations/route";
import { GET as messages } from "@/app/api/widget/[slug]/messages/route";
import {
  VISITOR_CALLS_PER_MINUTE,
  VISITOR_CONVERSATIONS_PER_HOUR,
} from "@/lib/assistant/limits";
import { hashToken } from "@/lib/tokens";
import { createSalon, serviceClient } from "./support";

// The widget's routes, called as the widget's frame calls them: a visitor with no account,
// known only by the token their browser keeps.

const APP = "http://localhost:3100";

/**
 * A visitor's address, new for every test: limits count per address over the last hour, and
 * the local database keeps conversations between runs.
 */
function newVisitorIp() {
  const byte = () => Math.floor(Math.random() * 256);
  return `10.${byte()}.${byte()}.${byte()}`;
}

type Salon = Awaited<ReturnType<typeof createSalon>>;
let salon: Salon;
let other: Salon;

beforeAll(async () => {
  [salon, other] = await Promise.all([
    createSalon("Palm Salon"),
    createSalon("Other Salon"),
  ]);
  const { error } = await serviceClient()
    .from("businesses")
    .update({ widget_enabled: true })
    .in("id", [salon.business.id, other.business.id]);
  if (error) throw error;
});

function context(slug: string) {
  return { params: Promise.resolve({ slug }) };
}

/** A request from the widget's frame: same origin as the app, from one visitor's address. */
function fromWidget(
  path: string,
  init: { body?: unknown; token?: string; ip?: string; origin?: string } = {},
) {
  return new Request(`${APP}${path}`, {
    method:
      init.body === undefined && !path.endsWith("/conversations")
        ? "GET"
        : "POST",
    headers: {
      origin: init.origin ?? APP,
      "sec-fetch-site":
        init.origin && init.origin !== APP ? "cross-site" : "same-origin",
      "x-real-ip": init.ip ?? newVisitorIp(),
      ...(init.token && { authorization: `Bearer ${init.token}` }),
      ...(init.body !== undefined && { "content-type": "application/json" }),
    },
    body: init.body === undefined ? undefined : JSON.stringify(init.body),
  });
}

async function startConversation(slug: string, ip?: string) {
  const response = await start(
    fromWidget(`/api/widget/${slug}/conversations`, { ip }),
    context(slug),
  );
  return {
    status: response.status,
    token: ((await response.json()) as { token?: string }).token,
  };
}

describe("starting and continuing a conversation", () => {
  it("hands the visitor a token, of which only the hash is kept", async () => {
    const { status, token } = await startConversation(
      salon.slug,
      newVisitorIp(),
    );
    expect(status).toBe(201);
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    const { data } = await serviceClient()
      .from("conversations")
      .select("channel, visitor_token_hash")
      .eq("visitor_token_hash", hashToken(token!))
      .single();
    expect(data).toEqual({
      channel: "widget",
      visitor_token_hash: hashToken(token!),
    });
  });

  it("answers with the token, and gives the conversation back on reload", async () => {
    const ip = newVisitorIp();
    const { token } = await startConversation(salon.slug, ip);
    const reply = await chat(
      fromWidget(`/api/widget/${salon.slug}/chat`, {
        token,
        ip,
        body: { text: "Is there parking?" },
      }),
      context(salon.slug),
    );
    expect(reply.status).toBe(200);
    expect(await reply.text()).toContain("Palm Salon has free parking");

    // The reply is saved when its stream ends.
    let stored: { status: string; messages: { role: string }[] } | undefined;
    for (
      let attempt = 0;
      attempt < 40 && stored?.messages.at(-1)?.role !== "assistant";
      attempt += 1
    ) {
      const response = await messages(
        fromWidget(`/api/widget/${salon.slug}/messages`, { token }),
        context(salon.slug),
      );
      stored = await response.json();
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
    expect(stored?.status).toBe("open");
    expect(stored?.messages.map((message) => message.role)).toEqual([
      "user",
      "assistant",
    ]);
  });

  it("shows a staff member's reply, and that a person has the conversation", async () => {
    const { token } = await startConversation(salon.slug, newVisitorIp());
    const { data: conversation } = await serviceClient()
      .from("conversations")
      .select("id")
      .eq("visitor_token_hash", hashToken(token!))
      .single();
    // From the inbox: a member takes the conversation over and replies.
    const target = { target_conversation_id: conversation!.id };
    await salon.ownerClient.rpc("take_over_conversation", target);
    await salon.ownerClient.rpc("reply_to_conversation", {
      ...target,
      body: "Hi, it's Layla.",
    });
    const response = await messages(
      fromWidget(`/api/widget/${salon.slug}/messages`, { token }),
      context(salon.slug),
    );
    expect(await response.json()).toEqual({
      status: "taken_over",
      messages: [
        {
          id: expect.stringMatching(/^staff-/),
          role: "assistant",
          metadata: { from: "staff" },
          parts: [{ type: "text", text: "Hi, it's Layla." }],
        },
      ],
    });
  });
});

describe("who can reach a conversation", () => {
  it("nothing while the business's widget is off", async () => {
    await serviceClient()
      .from("businesses")
      .update({ widget_enabled: false })
      .eq("id", other.business.id);
    const { status } = await startConversation(other.slug, newVisitorIp());
    expect(status).toBe(404);
    await serviceClient()
      .from("businesses")
      .update({ widget_enabled: true })
      .eq("id", other.business.id);
  });

  it("only the token's holder, only at its own business", async () => {
    const { token } = await startConversation(salon.slug, newVisitorIp());
    const noToken = await messages(
      fromWidget(`/api/widget/${salon.slug}/messages`),
      context(salon.slug),
    );
    expect(noToken.status).toBe(404);
    const wrongToken = await messages(
      fromWidget(`/api/widget/${salon.slug}/messages`, {
        token: "A".repeat(43),
      }),
      context(salon.slug),
    );
    expect(wrongToken.status).toBe(404);
    const otherBusiness = await chat(
      fromWidget(`/api/widget/${other.slug}/chat`, {
        token,
        body: { text: "Hello" },
      }),
      context(other.slug),
    );
    expect(otherBusiness.status).toBe(404);
  });

  it("only from Hala's own pages, not a script on another site", async () => {
    const response = await start(
      fromWidget(`/api/widget/${salon.slug}/conversations`, {
        origin: "https://evil.example",
      }),
      context(salon.slug),
    );
    expect(response.status).toBe(403);
  });
});

describe("per-visitor limits", () => {
  it("caps the conversations one visitor starts in an hour", async () => {
    const ip = newVisitorIp();
    for (
      let started = 0;
      started < VISITOR_CONVERSATIONS_PER_HOUR;
      started += 1
    ) {
      expect((await startConversation(salon.slug, ip)).status).toBe(201);
    }
    expect((await startConversation(salon.slug, ip)).status).toBe(429);
    expect((await startConversation(salon.slug, newVisitorIp())).status).toBe(
      201,
    );
  });

  it("caps the model calls one visitor causes in a minute", async () => {
    const ip = newVisitorIp();
    const { token } = await startConversation(salon.slug, ip);
    const { data: conversation } = await serviceClient()
      .from("conversations")
      .select("id")
      .eq("visitor_token_hash", hashToken(token!))
      .single();
    await serviceClient()
      .from("model_calls")
      .insert(
        Array.from({ length: VISITOR_CALLS_PER_MINUTE }, () => ({
          business_id: salon.business.id,
          conversation_id: conversation!.id,
          purpose: "chat",
          model: "offline",
          input_tokens: 10,
          cost_usd: 0,
          latency_ms: 0,
        })),
      );
    const response = await chat(
      fromWidget(`/api/widget/${salon.slug}/chat`, {
        token,
        ip,
        body: { text: "Hello" },
      }),
      context(salon.slug),
    );
    expect(response.status).toBe(429);
  });
});
