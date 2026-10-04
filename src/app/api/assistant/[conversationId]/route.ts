import { z } from "zod";
import { runAssistantTurn } from "@/lib/assistant/turn";
import { createServerActionClient } from "@/lib/supabase/server";

// One turn of a test conversation, for members trying the assistant from the dashboard. The
// customer-facing widget (Phase 5) gets its own route with its own access check; both run the
// same turn.

const turnSchema = z.union([
  z.object({ text: z.string().trim().min(1).max(2000) }),
  z.object({
    approvals: z
      .array(
        z.object({ id: z.string().min(1).max(200), approved: z.boolean() }),
      )
      .min(1)
      .max(10),
  }),
]);

export async function POST(
  request: Request,
  { params }: RouteContext<"/api/assistant/[conversationId]">,
) {
  const { conversationId } = await params;
  const supabase = await createServerActionClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims) {
    return Response.json({ error: "Sign in first." }, { status: 401 });
  }

  // Through RLS as the user: members see only their own business's conversations.
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("id, channel")
    .eq("id", conversationId)
    .maybeSingle();
  if (error && error.code !== "22P02") {
    console.error("Loading a conversation failed", { code: error.code });
    return Response.json({ error: "Please try again." }, { status: 500 });
  }
  if (!conversation || conversation.channel !== "test") {
    return Response.json({ error: "No such conversation." }, { status: 404 });
  }

  const parsed = turnSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Send a message." }, { status: 400 });
  }

  try {
    return await runAssistantTurn({
      conversationId: conversation.id,
      input: parsed.data,
      abortSignal: request.signal,
    });
  } catch (turnError) {
    console.error("An assistant turn failed", {
      name: turnError instanceof Error ? turnError.name : "UnknownError",
    });
    return Response.json(
      { error: "Something went wrong. Please try again." },
      { status: 500 },
    );
  }
}
