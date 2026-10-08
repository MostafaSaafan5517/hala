import {
  ArrowLeft,
  ChatCircleDots,
  CheckCircle,
  Hourglass,
  UserCircle,
} from "@phosphor-icons/react/ssr";
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
import { SectionHeader } from "@/components/section-header";
import { surface } from "@/components/surface";
import { buttonVariants } from "@/components/ui/button";
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

/** The status's icon, in its tone (as in its badge). */
const statusIcons = {
  open: <ChatCircleDots aria-hidden="true" className="size-5" />,
  needs_human: <Hourglass aria-hidden="true" className="size-5 text-warning" />,
  taken_over: (
    <UserCircle aria-hidden="true" className="size-5 text-accent-foreground" />
  ),
  closed: <CheckCircle aria-hidden="true" className="size-5" />,
};

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

      <section className="grid gap-6" aria-labelledby="conversation-heading">
        <SectionHeader
          id="conversation-heading"
          title={
            customer ? (
              <>
                Conversation with <span dir="auto">{customer.name}</span>
              </>
            ) : (
              "Conversation with a website visitor"
            )
          }
          action={
            <Link
              href={`/dashboard/b/${business.slug}/inbox`}
              className={buttonVariants({ variant: "ghost", size: "sm" })}
            >
              <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
              All conversations
            </Link>
          }
        />

        {/* From 1024px the transcript sits beside the panel; on a phone the panel comes first. */}
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_20rem]">
          <div className="grid gap-4 lg:sticky lg:top-6 lg:order-2">
            <div role="status" className={`${surface} grid gap-2 p-5`}>
              <p className="flex items-center gap-2 font-medium">
                {statusIcons[status]}
                <span>
                  {conversationStatusLabels[status]}
                  {status === "taken_over" && conversation.taker?.full_name && (
                    <>
                      {": "}
                      <span dir="auto">{conversation.taker.full_name}</span>
                    </>
                  )}
                </span>
              </p>
              <p className="text-small text-secondary-foreground">
                {statusNotes[status]}
              </p>
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
              className={`${surface} grid gap-3 p-5`}
              aria-labelledby="customer-heading"
            >
              <h3 id="customer-heading" className="text-large font-semibold">
                Customer
              </h3>
              {customer ? (
                <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2">
                  <dt className="text-small text-muted-foreground">Name</dt>
                  <dd dir="auto">{customer.name}</dd>
                  <dt className="text-small text-muted-foreground">Phone</dt>
                  <dd dir="ltr" className="text-start">
                    {formatPhone(customer.phone)}
                  </dd>
                  {customer.email && (
                    <>
                      <dt className="text-small text-muted-foreground">
                        Email
                      </dt>
                      <dd dir="ltr" className="text-start wrap-anywhere">
                        {customer.email}
                      </dd>
                    </>
                  )}
                  <dt className="text-small text-muted-foreground">Language</dt>
                  <dd>{languageNames[customer.language]}</dd>
                </dl>
              ) : (
                <p className="text-small text-secondary-foreground">
                  Not known yet. The assistant learns who a customer is when
                  they book, or prove a booking is theirs.
                </p>
              )}
              <p className="text-caption text-muted-foreground tabular-nums">
                Started{" "}
                {formatLocalDateTime(
                  conversation.created_at,
                  business.timezone,
                )}
              </p>
            </section>
          </div>

          <div className="grid min-w-0 gap-6 lg:order-1">
            <section
              className="grid gap-3"
              aria-labelledby="transcript-heading"
            >
              <h3 id="transcript-heading" className="text-h3">
                Transcript
              </h3>
              <Transcript messages={messages} />
            </section>

            {status === "taken_over" && (
              <ReplyForm
                action={reply.bind(null, business.slug, conversation.id)}
              />
            )}
          </div>
        </div>
      </section>
    </>
  );
}
