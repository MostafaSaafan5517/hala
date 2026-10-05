import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound, redirect } from "next/navigation";
import { isReadOnly, refuseReadOnly, requireUser } from "@/lib/auth";
import type { Database, Enums } from "@/lib/supabase/database.types";
import { createServerActionClient } from "@/lib/supabase/server";

export type MemberRole = Enums<"member_role">;

export const roleLabels: Record<MemberRole, string> = {
  owner: "Owner",
  admin: "Admin",
  staff: "Staff",
};

/**
 * The business with this slug and the user's role there, or null when they aren't a member.
 * Reads through RLS as the user, starting from their member row.
 */
export async function getMemberBusiness(
  supabase: SupabaseClient<Database>,
  userId: string,
  slug: string,
) {
  const { data, error } = await supabase
    .from("business_members")
    .select(
      `role, businesses!inner(
        id, name, slug, timezone, default_language, booking_notice_minutes,
        booking_horizon_days, slot_interval_minutes, cancellation_notice_hours
      )`,
    )
    .eq("user_id", userId)
    .eq("businesses.slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Could not load the business: ${error.message}`);
  if (!data) return null;
  return { role: data.role, business: data.businesses };
}

/**
 * For Server Actions on a business: a client that can write the session cookies, the user's id,
 * and their membership, or null when they aren't a member. Visitors are sent to sign in and back
 * to `currentPath`. Actions take their arguments from the browser, so each one checks the role
 * it needs from this, and RLS checks again in the database.
 */
export async function memberForAction(
  slug: string,
  currentPath: string,
  options: { allowReadOnly?: boolean } = {},
) {
  const supabase = await createServerActionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  // A read-only account (the public demo) changes nothing: back to the page, which says why. The
  // database refuses its writes anyway; this is the friendly half. Actions that only write
  // through server code, like starting a test chat, opt out.
  if (isReadOnly(data.claims) && !options.allowReadOnly) {
    refuseReadOnly(currentPath);
  }
  const member = await getMemberBusiness(supabase, data.claims.sub, slug);
  return { supabase, userId: data.claims.sub, member };
}

/**
 * For pages under /dashboard/b/[slug]: the signed-in user's Supabase client, the business and
 * their role there. Visitors are sent to sign in (and back to `currentPath`). Anyone who isn't a
 * member, or whose role isn't in `roles`, gets a 404, which also avoids confirming the business
 * (or the page) exists.
 */
export async function requireMemberBusiness(
  slug: string,
  currentPath: string,
  roles: readonly MemberRole[] = ["owner", "admin", "staff"],
) {
  const { supabase, userId } = await requireUser(currentPath);
  const member = await getMemberBusiness(supabase, userId, slug);
  if (!member || !roles.includes(member.role)) notFound();
  return { supabase, userId, ...member };
}
