"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/action-button";
import { memberForAction } from "@/lib/business";

// The inbox's actions. Each calls a database function that checks the caller is a member of the
// conversation's business and that the change fits where the conversation stands.

function failureMessage(error: { code: string }, action: string) {
  // HB009: someone else (or the customer) changed the conversation since the page loaded.
  if (error.code === "HB009") {
    return "This conversation has changed since you opened it. Refresh the page to see where it stands.";
  }
  if (error.code === "P0002") return "This conversation no longer exists.";
  console.error(`${action} failed`, { code: error.code });
  return "Something went wrong. Please try again.";
}

async function changeConversation(
  slug: string,
  conversationId: string,
  action:
    "take_over_conversation" | "hand_back_conversation" | "close_conversation",
  description: string,
): Promise<ActionState> {
  const { supabase, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/inbox/${conversationId}`,
  );
  if (!member) return { error: "You're no longer a member of this business." };

  const { error } = await supabase.rpc(action, {
    target_conversation_id: conversationId,
  });
  if (error) return { error: failureMessage(error, description) };

  refresh();
  return { error: null };
}

/** The assistant stops answering; the customer's messages wait for the team. */
export async function takeOver(slug: string, conversationId: string) {
  return changeConversation(
    slug,
    conversationId,
    "take_over_conversation",
    "Taking a conversation over",
  );
}

/** The assistant answers the customer's next message again. */
export async function handBack(slug: string, conversationId: string) {
  return changeConversation(
    slug,
    conversationId,
    "hand_back_conversation",
    "Handing a conversation back",
  );
}

/** Nobody can add to it; the customer is offered a new conversation. */
export async function closeConversation(slug: string, conversationId: string) {
  return changeConversation(
    slug,
    conversationId,
    "close_conversation",
    "Closing a conversation",
  );
}

export type ReplyState = { error: string | null; text: string };

const replySchema = z
  .string()
  .trim()
  .min(1, "Write a reply first.")
  .max(2000, "Keep a reply under 2000 characters.");

/** A reply from the team, in the customer's chat. */
export async function reply(
  slug: string,
  conversationId: string,
  _previous: ReplyState,
  formData: FormData,
): Promise<ReplyState> {
  const text = String(formData.get("reply") ?? "");
  const { supabase, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/inbox/${conversationId}`,
  );
  if (!member) {
    return { error: "You're no longer a member of this business.", text };
  }
  const parsed = replySchema.safeParse(text);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null, text };
  }

  const { error } = await supabase.rpc("reply_to_conversation", {
    target_conversation_id: conversationId,
    body: parsed.data,
  });
  if (error) {
    return { error: failureMessage(error, "Replying to a customer"), text };
  }

  refresh();
  return { error: null, text: "" };
}
