import "server-only";
import { createHmac } from "node:crypto";
import { toolApprovalSecret } from "@/lib/ai/chat-model";
import { createAdminClient } from "@/lib/supabase/admin";
import { hashToken } from "@/lib/tokens";

// The widget's server side. Visitors don't sign in: a widget conversation belongs to whoever
// holds its random token, which their browser keeps and sends as a bearer token. The routes use
// the admin client because visitors have no database role; every query is scoped to the
// business in the URL, and to the conversation the token opens.

/** The business behind a widget, when its widget is switched on. */
export async function widgetBusiness(slug: string) {
  const { data, error } = await createAdminClient()
    .from("businesses")
    .select(
      "id, name, slug, timezone, default_language, widget_enabled, widget_origins",
    )
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Could not load the business: ${error.message}`);
  return data?.widget_enabled ? data : null;
}

/**
 * A keyed hash of the visitor's IP address, for per-visitor limits: the same visitor always
 * hashes the same way, but the address can't be recovered or matched outside Hala. The key is
 * derived from the server secret with its own label, so it's never the approval-signing key.
 * On Vercel, x-real-ip and x-forwarded-for are set by the platform, not the visitor.
 */
export function visitorHash(request: Request) {
  const ip =
    request.headers.get("x-real-ip") ??
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    "unknown";
  const key = createHmac("sha256", toolApprovalSecret())
    .update("hala:visitor-hash")
    .digest();
  return createHmac("sha256", key).update(ip).digest("hex");
}

/**
 * Whether a request comes from Hala's own pages (the widget's frame), rather than a script on
 * another site using the visitor's browser. Browsers send Origin on cross-site requests and
 * Sec-Fetch-Site on all of them.
 */
export function fromOwnPages(request: Request) {
  const origin = request.headers.get("origin");
  const site = request.headers.get("sec-fetch-site");
  return (
    (origin === null || origin === new URL(request.url).origin) &&
    (site === null || site === "same-origin")
  );
}

/** The conversation a visitor's bearer token opens, in this business. */
export async function visitorConversation(
  request: Request,
  businessId: string,
) {
  const token = request.headers
    .get("authorization")
    ?.match(/^Bearer ([A-Za-z0-9_-]{43})$/)?.[1];
  if (!token) return null;
  const { data, error } = await createAdminClient()
    .from("conversations")
    .select("id, status, visitor_hash")
    .eq("business_id", businessId)
    .eq("channel", "widget")
    .eq("visitor_token_hash", hashToken(token))
    .maybeSingle();
  if (error) {
    throw new Error(`Could not load the conversation: ${error.message}`);
  }
  return data;
}

/** What a visitor has used, for the widget's limits. */
export async function usageOfVisitor(hash: string) {
  const { data, error } = await createAdminClient()
    .rpc("visitor_usage", { target_visitor_hash: hash })
    .single();
  if (error) throw new Error(`Could not check usage: ${error.message}`);
  return data;
}
