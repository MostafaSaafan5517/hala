import { createAdminClient } from "@/lib/supabase/admin";
import {
  fromOwnPages,
  visitorConversation,
  widgetBusiness,
} from "@/lib/widget/server";

// The visitor's conversation as stored, and its status: to pick it up again after a reload, and
// to see a staff member's replies while a person has it.
export async function GET(
  request: Request,
  { params }: RouteContext<"/api/widget/[slug]/messages">,
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

  const { data, error } = await createAdminClient()
    .from("conversation_messages")
    .select("message")
    .eq("conversation_id", conversation.id)
    .order("position");
  if (error) {
    console.error("Loading widget messages failed", { code: error.code });
    return Response.json({ error: "Please try again." }, { status: 500 });
  }
  return Response.json(
    {
      status: conversation.status,
      messages: data.map((row) => row.message),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
