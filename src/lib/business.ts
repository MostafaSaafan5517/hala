import type { SupabaseClient } from "@supabase/supabase-js";
import { notFound } from "next/navigation";
import { requireUser } from "@/lib/auth";
import type { Database, Enums } from "@/lib/supabase/database.types";

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
      "role, businesses!inner(id, name, slug, timezone, default_language)",
    )
    .eq("user_id", userId)
    .eq("businesses.slug", slug)
    .maybeSingle();
  if (error) throw new Error(`Could not load the business: ${error.message}`);
  if (!data) return null;
  return { role: data.role, business: data.businesses };
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
