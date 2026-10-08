import { ArrowLeft, Info } from "@phosphor-icons/react/ssr";
import type { UIMessage } from "ai";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AssistantChat } from "@/app/(app)/dashboard/b/[slug]/assistant/assistant-chat";
import { conversationStatusLabels } from "@/app/(app)/dashboard/b/[slug]/conversation-status";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { SectionHeader } from "@/components/section-header";
import { buttonVariants } from "@/components/ui/button";
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

      <section
        className="grid max-w-3xl gap-4"
        aria-labelledby="conversation-heading"
      >
        <SectionHeader
          id="conversation-heading"
          title="Test conversation"
          description={`You're the customer here. Bookings you confirm are real. Model: ${model}. ${modelNotes[model] ?? ""}`}
          action={
            <Link
              href={`/dashboard/b/${business.slug}/assistant`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
              All test conversations
            </Link>
          }
        />
        {conversation.status !== "open" && (
          <p
            role="status"
            className="flex items-start gap-2 rounded-surface bg-warning-soft px-4 py-3 text-warning"
          >
            <span className="flex h-lh shrink-0 items-center">
              <Info aria-hidden="true" className="size-4" />
            </span>
            <span>
              {conversationStatusLabels[conversation.status]}: the assistant has
              handed this conversation to the team.
            </span>
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
