"use server";

import { refresh } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-button";
import { memberForAction } from "@/lib/business";
import { createToken } from "@/lib/tokens";

// Every argument comes from the browser, so each action checks the user's role again; RLS
// decides once more in the database (see the business_members and member_invites policies).

async function requireTeamMember(slug: string) {
  const { supabase, userId, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/team`,
  );
  return { supabase, userId, member };
}

export type InviteFormState = {
  error: string | null;
  link: string | null;
  role: "admin" | "staff" | null;
};

/** Makes a single-use invite link for a role. The link is shown once: only its hash is stored. */
export async function createInvite(
  slug: string,
  _previous: InviteFormState,
  formData: FormData,
): Promise<InviteFormState> {
  const failed = (error: string) => ({ error, link: null, role: null });
  const { supabase, member } = await requireTeamMember(slug);
  if (!member || member.role === "staff") {
    return failed("Only owners and admins can invite people.");
  }
  const role = formData.get("role");
  if (role !== "admin" && role !== "staff") return failed("Choose a role.");
  if (role === "admin" && member.role !== "owner") {
    return failed("Only the owner can invite admins.");
  }

  // Next.js has already checked that this Server Action call comes from our own origin.
  const origin = (await headers()).get("origin");
  if (!origin) {
    throw new Error("Server Action request without an Origin header.");
  }

  const { token, tokenHash } = createToken();
  const { error } = await supabase.from("member_invites").insert({
    business_id: member.business.id,
    role,
    token_hash: tokenHash,
  });
  if (error) {
    console.error("Creating an invite failed", { code: error.code });
    return failed("We couldn't create the invite. Please try again.");
  }

  refresh();
  return { error: null, link: `${origin}/invite/${token}`, role };
}

/** Revokes an invite nobody has used yet. */
export async function revokeInvite(
  slug: string,
  inviteId: string,
): Promise<ActionState> {
  const { supabase, member } = await requireTeamMember(slug);
  if (!member || member.role === "staff") {
    return { error: "Only owners and admins can revoke invites." };
  }

  const { data: revoked, error } = await supabase
    .from("member_invites")
    .delete()
    .eq("id", inviteId)
    .eq("business_id", member.business.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Revoking an invite failed", { inviteId, code: error.code });
    return { error: "We couldn't revoke the invite. Please try again." };
  }
  if (!revoked) return { error: "That invite was already used or revoked." };

  refresh();
  return { error: null };
}

/** The owner moves someone between admin and staff. */
export async function setMemberRole(
  slug: string,
  userId: string,
  role: "admin" | "staff",
): Promise<ActionState> {
  const { supabase, member } = await requireTeamMember(slug);
  if (member?.role !== "owner") {
    return { error: "Only the owner can change roles." };
  }

  const { data: updated, error } = await supabase
    .from("business_members")
    .update({ role })
    .eq("business_id", member.business.id)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (error) {
    console.error("Changing a role failed", { code: error.code });
    return { error: "We couldn't change the role. Please try again." };
  }
  if (!updated) return { error: "That person isn't on the team anymore." };

  refresh();
  return { error: null };
}

/**
 * Takes someone off the team: the owner removes admins or staff, admins remove staff, and
 * anyone but the owner can remove themselves (leave).
 */
export async function removeFromTeam(
  slug: string,
  userId: string,
): Promise<ActionState> {
  const {
    supabase,
    userId: currentUserId,
    member,
  } = await requireTeamMember(slug);
  if (!member) return { error: "You're not on this team." };
  const leaving = userId === currentUserId;
  if (leaving && member.role === "owner") {
    return { error: "The owner can't leave their own business." };
  }
  if (!leaving && member.role === "staff") {
    return { error: "Only owners and admins can remove people." };
  }

  const { data: removed, error } = await supabase
    .from("business_members")
    .delete()
    .eq("business_id", member.business.id)
    .eq("user_id", userId)
    .select("user_id")
    .maybeSingle();
  if (error) {
    console.error("Removing someone from a team failed", { code: error.code });
    return { error: "We couldn't make that change. Please try again." };
  }
  if (!removed) {
    return { error: "You can't remove that person, or they've already left." };
  }

  if (leaving) redirect("/dashboard");
  refresh();
  return { error: null };
}
