import { VISITOR_CALLS_PER_MINUTE } from "@/lib/assistant/limits";
import { runAssistantTurn, turnInputSchema } from "@/lib/assistant/turn";
import {
  fromOwnPages,
  usageOfVisitor,
  visitorConversation,
  widgetBusiness,
} from "@/lib/widget/server";

// One turn of a widget conversation: the same turn as everywhere (stored messages, signed
// approvals, the business's limits), opened by the visitor's token, with per-visitor limits
// first.
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/widget/[slug]/chat">,
) {
  if (!fromOwnPages(request)) {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }
  const { slug } = await params;
  const business = await widgetBusiness(slug);
  const conversation =
    business && (await visitorConversation(request, business.id));
  if (!conversation) {
    return Response.json({ error: "No such conversation." }, { status: 404 });
  }

  const parsed = turnInputSchema.safeParse(
    await request.json().catch(() => null),
  );
  if (!parsed.success) {
    return Response.json({ error: "Send a message." }, { status: 400 });
  }

  const usage = await usageOfVisitor(conversation.visitor_hash!);
  if (usage.chat_calls_last_minute >= VISITOR_CALLS_PER_MINUTE) {
    return Response.json(
      { error: "You're sending messages quickly. Please wait a minute." },
      { status: 429 },
    );
  }

  try {
    return await runAssistantTurn({
      conversationId: conversation.id,
      input: parsed.data,
      abortSignal: request.signal,
    });
  } catch (error) {
    console.error("A widget turn failed", {
      name: error instanceof Error ? error.name : "UnknownError",
    });
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
