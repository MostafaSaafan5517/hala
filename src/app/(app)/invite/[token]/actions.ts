"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-button";
import { createServerActionClient } from "@/lib/supabase/server";

// Postgres error codes raised by accept_member_invite.
const INVALID_INVITE = "P0002";
const ALREADY_MEMBER = "23505";

/** Joins the signed-in user to the invite's business, then opens its dashboard. */
export async function acceptInvite(token: string): Promise<ActionState> {
  const supabase = await createServerActionClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect(`/login?next=${encodeURIComponent(`/invite/${token}`)}`);

  // The database checks the token, adds the user with the invite's role and marks the invite
  // used, in one transaction.
  const { data: slug, error } = await supabase.rpc("accept_member_invite", {
    invite_token: token,
  });
  if (error) {
    if (error.code === INVALID_INVITE) {
      return {
        error:
          "This invite link doesn't work anymore. Ask whoever sent it for a new one.",
      };
    }
    if (error.code === ALREADY_MEMBER) {
      return { error: "You already work at this business." };
    }
    console.error("Accepting an invite failed", { code: error.code });
    return { error: "We couldn't accept the invite. Please try again." };
  }

  redirect(`/dashboard/b/${slug}`);
}
