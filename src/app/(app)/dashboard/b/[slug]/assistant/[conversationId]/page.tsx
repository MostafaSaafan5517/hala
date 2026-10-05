import type { UIMessage } from "ai";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssistantChat } from "@/app/(app)/dashboard/b/[slug]/assistant/assistant-chat";
import { conversationStatusLabels } from "@/app/(app)/dashboard/b/[slug]/conversation-status";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { chatModelId } from "@/lib/ai/chat-model";
import { requireMemberBusiness } from "@/lib/business";

export const metadata: Metadata = { title: "Test conversation" };

const modelNotes: Record<string, string> = {
  offline:
    'The offline stand-in model answers only from the knowledge base, and books only from an exact request like "book Haircut on 2026-10-05 at 10:00 for Mona Adel, +20 10 1234 5678".',
};

export default async function TestConversationPage({
  params,
}: PageProps<"/dashboard/b/[slug]/assistant/[conversationId]">) {
  const { slug, conversationId } = await params;
  const { supabase, business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/assistant/${conversationId}`,
  );

  // Through RLS as the user: only their business's conversations.
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select("id, status, conversation_messages (message, position)")
    .eq("id", conversationId)
    .eq("business_id", business.id)
    .eq("channel", "test")
    .order("position", { referencedTable: "conversation_messages" })
    .maybeSingle();
  // A malformed id is just a conversation that doesn't exist.
  if (error && error.code !== "22P02") {
    throw new Error(`Could not load the conversation: ${error.message}`);
  }
  if (!conversation) notFound();

  const model = chatModelId();
  const messages = conversation.conversation_messages.map(
    (row) => row.message as unknown as UIMessage,
  );

  return (
    <>
      <BusinessHeader business={business} role={role} current="assistant" />

      <section className="grid gap-3" aria-labelledby="conversation-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="conversation-heading" className="text-lg font-semibold">
            Test conversation
          </h2>
          <Link
            href={`/dashboard/b/${business.slug}/assistant`}
            className="text-sm underline-offset-4 hover:underline"
          >
            All test conversations
          </Link>
        </div>
        <p className="text-sm text-muted-foreground">
          You&apos;re the customer here. Bookings you confirm are real. Model:{" "}
          {model}. {modelNotes[model]}
        </p>
        {conversation.status !== "open" && (
          <p role="status" className="rounded-lg border p-3 text-sm">
            {conversationStatusLabels[conversation.status]}: the assistant has
            handed this conversation to the team.
          </p>
        )}
        <AssistantChat
          conversationId={conversation.id}
          initialMessages={messages}
        />
      </section>
    </>
  );
}
