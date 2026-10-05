import { VISITOR_CONVERSATIONS_PER_HOUR } from "@/lib/assistant/limits";
import { createAdminClient } from "@/lib/supabase/admin";
import { createToken } from "@/lib/tokens";
import {
  fromOwnPages,
  usageOfVisitor,
  visitorHash,
  widgetBusiness,
} from "@/lib/widget/server";

// Starts a widget conversation and hands the visitor its token, once. Their browser keeps it to
// carry on (and to come back to the conversation); only its hash is stored.
export async function POST(
  request: Request,
  { params }: RouteContext<"/api/widget/[slug]/conversations">,
) {
  if (!fromOwnPages(request)) {
    return Response.json({ error: "Not allowed." }, { status: 403 });
  }
  const { slug } = await params;
  const business = await widgetBusiness(slug);
  if (!business) {
    return Response.json({ error: "No such widget." }, { status: 404 });
  }

  const visitor = visitorHash(request);
  const usage = await usageOfVisitor(visitor);
  if (usage.conversations_last_hour >= VISITOR_CONVERSATIONS_PER_HOUR) {
    return Response.json(
      { error: "Too many new conversations. Please try again later." },
      { status: 429 },
    );
  }

  const { token, tokenHash } = createToken();
  const { error } = await createAdminClient().from("conversations").insert({
    business_id: business.id,
    channel: "widget",
    visitor_token_hash: tokenHash,
    visitor_hash: visitor,
  });
  if (error) {
    console.error("Starting a widget conversation failed", {
      code: error.code,
    });
    return Response.json({ error: "Please try again." }, { status: 500 });
  }
  return Response.json({ token }, { status: 201 });
}
