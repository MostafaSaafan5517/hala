"use server";

import { redirect } from "next/navigation";
import type { ActionState } from "@/components/action-button";
import { memberForAction } from "@/lib/business";
import { createAdminClient } from "@/lib/supabase/admin";

/**
 * Starts a test conversation: a member chatting with the assistant as a customer would. Any
 * member may; conversations are written by server code only, so this uses the admin client
 * after checking membership.
 */
export async function startTestConversation(
  slug: string,
): Promise<ActionState> {
  // Demo visitors (read-only accounts) may try the assistant: only server code writes here.
  const { userId, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/assistant`,
    { allowReadOnly: true },
  );
  if (!member) return { error: "You're no longer a member of this business." };

  const { data: conversation, error } = await createAdminClient()
    .from("conversations")
    .insert({
      business_id: member.business.id,
      channel: "test",
      started_by: userId,
    })
    .select("id")
    .single();
  if (error) {
    console.error("Starting a test conversation failed", { code: error.code });
    return { error: "We couldn't start a conversation. Please try again." };
  }

  redirect(`/dashboard/b/${slug}/assistant/${conversation.id}`);
}
