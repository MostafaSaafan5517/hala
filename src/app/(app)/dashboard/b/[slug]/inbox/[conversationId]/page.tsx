import type { UIMessage } from "ai";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { conversationStatusLabels } from "@/app/(app)/dashboard/b/[slug]/conversation-status";
import {
  closeConversation,
  handBack,
  reply,
  takeOver,
} from "@/app/(app)/dashboard/b/[slug]/inbox/actions";
import { AutoRefresh } from "@/app/(app)/dashboard/b/[slug]/inbox/auto-refresh";
import { ReplyForm } from "@/app/(app)/dashboard/b/[slug]/inbox/[conversationId]/reply-form";
import { Transcript } from "@/app/(app)/dashboard/b/[slug]/inbox/[conversationId]/transcript";
import { ActionButton } from "@/components/action-button";
import { requireMemberBusiness } from "@/lib/business";
import { formatLocalDateTime } from "@/lib/dates";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Conversation" };

const statusNotes = {
  open: "The assistant is answering. Take over to reply yourself.",
  needs_human:
    "The assistant asked for a person. Take over to reply; it keeps answering until you do.",
  taken_over:
    "The assistant is paused: the customer's messages wait for you here, and your replies appear in their chat.",
  closed:
    "Closed. If the customer writes again, they start a new conversation.",
};

const languageNames = { ar: "Arabic", en: "English" };

export default async function InboxConversationPage({
  params,
}: PageProps<"/dashboard/b/[slug]/inbox/[conversationId]">) {
  const { slug, conversationId } = await params;
  const { supabase, business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/inbox/${conversationId}`,
  );

  // Through RLS as the user: only their business's conversations.
  const { data: conversation, error } = await supabase
    .from("conversations")
    .select(
      "id, status, created_at, customer:customers (name, phone, email, language), taker:profiles!taken_over_by (full_name), conversation_messages (message, position, sender:profiles!sent_by (full_name))",
    )
    .eq("id", conversationId)
    .eq("business_id", business.id)
    .eq("channel", "widget")
    .order("position", { referencedTable: "conversation_messages" })
    .maybeSingle();
  // A malformed id is just a conversation that doesn't exist.
  if (error && error.code !== "22P02") {
    throw new Error(`Could not load the conversation: ${error.message}`);
  }
  if (!conversation) notFound();

  const { customer, status } = conversation;
  const messages = conversation.conversation_messages.map((row) => ({
    message: row.message as unknown as UIMessage,
    sender: row.sender?.full_name ?? null,
  }));

  return (
    <>
      <BusinessHeader business={business} role={role} current="inbox" />
      {status !== "closed" && <AutoRefresh />}

      <section className="grid gap-4" aria-labelledby="conversation-heading">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 id="conversation-heading" className="text-lg font-semibold">
            {customer ? (
              <>
                Conversation with <span dir="auto">{customer.name}</span>
              </>
            ) : (
              "Conversation with a website visitor"
            )}
          </h2>
          <Link
            href={`/dashboard/b/${business.slug}/inbox`}
            className="text-sm underline-offset-4 hover:underline"
          >
            All conversations
          </Link>
        </div>

        <div role="status" className="grid gap-1 rounded-lg border p-3 text-sm">
          <p className="font-medium">
            {conversationStatusLabels[status]}
            {status === "taken_over" && conversation.taker?.full_name && (
              <>
                {": "}
                <span dir="auto">{conversation.taker.full_name}</span>
              </>
            )}
          </p>
          <p className="text-muted-foreground">{statusNotes[status]}</p>
        </div>

        {status !== "closed" && (
          <div className="flex flex-wrap items-start gap-2">
            {status === "taken_over" ? (
              <ActionButton
                action={handBack.bind(null, business.slug, conversation.id)}
                label="Hand back to the assistant"
                pendingLabel="Handing back..."
              />
            ) : (
              <ActionButton
                action={takeOver.bind(null, business.slug, conversation.id)}
                label="Take over"
                pendingLabel="Taking over..."
              />
            )}
            <ActionButton
              action={closeConversation.bind(
                null,
                business.slug,
                conversation.id,
              )}
              label="Close conversation"
              pendingLabel="Closing..."
              variant="outline"
            />
          </div>
        )}

        <section
          className="grid gap-2 rounded-lg border p-3 text-sm"
          aria-labelledby="customer-heading"
        >
          <h3 id="customer-heading" className="font-semibold">
            Customer
          </h3>
          {customer ? (
            <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <dt className="text-muted-foreground">Name</dt>
              <dd dir="auto">{customer.name}</dd>
              <dt className="text-muted-foreground">Phone</dt>
              <dd dir="ltr" className="text-start">
                {formatPhone(customer.phone)}
              </dd>
              {customer.email && (
                <>
                  <dt className="text-muted-foreground">Email</dt>
                  <dd dir="ltr" className="text-start">
                    {customer.email}
                  </dd>
                </>
              )}
              <dt className="text-muted-foreground">Language</dt>
              <dd>{languageNames[customer.language]}</dd>
            </dl>
          ) : (
            <p className="text-muted-foreground">
              Not known yet. The assistant learns who a customer is when they
              book, or prove a booking is theirs.
            </p>
          )}
          <p className="text-xs text-muted-foreground">
            Started{" "}
            {formatLocalDateTime(conversation.created_at, business.timezone)}
          </p>
        </section>

        <section className="grid gap-3" aria-labelledby="transcript-heading">
          <h3 id="transcript-heading" className="font-semibold">
            Transcript
          </h3>
          <Transcript messages={messages} />
        </section>

        {status === "taken_over" && (
          <ReplyForm
            action={reply.bind(null, business.slug, conversation.id)}
          />
        )}
      </section>
    </>
  );
}
