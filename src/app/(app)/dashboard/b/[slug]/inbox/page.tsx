import { ChatsCircle, Tray } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { ConversationStatusBadge } from "@/app/(app)/dashboard/b/[slug]/conversation-status";
import { AutoRefresh } from "@/app/(app)/dashboard/b/[slug]/inbox/auto-refresh";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import { surfaceLinkRow, surfaceList } from "@/components/surface";
import { requireMemberBusiness } from "@/lib/business";
import { formatLocalDateTime } from "@/lib/dates";
import type { Enums } from "@/lib/supabase/database.types";

export const metadata: Metadata = { title: "Inbox" };

type ConversationRow = {
  id: string;
  status: Enums<"conversation_status">;
  updated_at: string;
  customer: { name: string } | null;
};

function ConversationList({
  conversations,
  slug,
  timeZone,
  empty,
}: {
  conversations: ConversationRow[];
  slug: string;
  timeZone: string;
  empty: { icon: ReactNode; title: string; text: string };
}) {
  if (conversations.length === 0) {
    return (
      <EmptyState icon={empty.icon} title={empty.title}>
        {empty.text}
      </EmptyState>
    );
  }
  return (
    <ul className={surfaceList}>
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <Link
            href={`/dashboard/b/${slug}/inbox/${conversation.id}`}
            className={`${surfaceLinkRow} flex flex-wrap items-center justify-between gap-3`}
          >
            <span className="grid min-w-0 gap-0.5">
              <span className="font-medium" dir="auto">
                {conversation.customer?.name ?? "Website visitor"}
              </span>
              <span className="text-small text-muted-foreground tabular-nums">
                Last activity{" "}
                {formatLocalDateTime(conversation.updated_at, timeZone)}
              </span>
            </span>
            <ConversationStatusBadge status={conversation.status} />
          </Link>
        </li>
      ))}
    </ul>
  );
}

export default async function InboxPage({
  params,
}: PageProps<"/dashboard/b/[slug]/inbox">) {
  const { slug } = await params;
  const { supabase, business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/inbox`,
  );

  // Through RLS as the user: members see their business's conversations. Those waiting for a
  // person come first, the longest-waiting at the top; then the most recent of the rest.
  const columns = "id, status, updated_at, customer:customers (name)";
  const [waiting, recent] = await Promise.all([
    supabase
      .from("conversations")
      .select(columns)
      .eq("business_id", business.id)
      .eq("channel", "widget")
      .in("status", ["needs_human", "taken_over"])
      .order("status")
      .order("updated_at")
      .limit(50),
    supabase
      .from("conversations")
      .select(columns)
      .eq("business_id", business.id)
      .eq("channel", "widget")
      .in("status", ["open", "closed"])
      .order("updated_at", { ascending: false })
      .limit(20),
  ]);
  const error = waiting.error ?? recent.error;
  if (error) throw new Error(`Could not load conversations: ${error.message}`);

  return (
    <>
      <BusinessHeader business={business} role={role} current="inbox" />
      <AutoRefresh />

      <section className="grid gap-4" aria-labelledby="waiting-heading">
        <SectionHeader
          id="waiting-heading"
          title="Waiting for the team"
          description="Customers the assistant handed over, and conversations someone has taken over."
        />
        <ConversationList
          conversations={waiting.data ?? []}
          slug={business.slug}
          timeZone={business.timezone}
          empty={{
            icon: <Tray aria-hidden="true" />,
            title: "Nobody is waiting.",
            text: "When the assistant hands a customer over, they appear here first.",
          }}
        />
      </section>

      <section className="grid gap-4" aria-labelledby="recent-heading">
        <SectionHeader id="recent-heading" title="Recent conversations" />
        <ConversationList
          conversations={recent.data ?? []}
          slug={business.slug}
          timeZone={business.timezone}
          empty={{
            icon: <ChatsCircle aria-hidden="true" />,
            title: "No conversations from your website yet.",
            text: "Turn the widget on in the Widget tab, and customers' chats appear here.",
          }}
        />
      </section>
    </>
  );
}
