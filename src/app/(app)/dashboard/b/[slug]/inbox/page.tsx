import type { Metadata } from "next";
import Link from "next/link";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { conversationStatusLabels } from "@/app/(app)/dashboard/b/[slug]/conversation-status";
import { AutoRefresh } from "@/app/(app)/dashboard/b/[slug]/inbox/auto-refresh";
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
  empty: string;
}) {
  if (conversations.length === 0) {
    return (
      <p className="rounded-lg border p-4 text-sm text-muted-foreground">
        {empty}
      </p>
    );
  }
  return (
    <ul className="grid gap-2">
      {conversations.map((conversation) => (
        <li key={conversation.id}>
          <Link
            href={`/dashboard/b/${slug}/inbox/${conversation.id}`}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm hover:bg-muted/50"
          >
            <span className="grid gap-0.5">
              <span className="font-medium" dir="auto">
                {conversation.customer?.name ?? "Website visitor"}
              </span>
              <span className="text-xs text-muted-foreground">
                Last activity{" "}
                {formatLocalDateTime(conversation.updated_at, timeZone)}
              </span>
            </span>
            <span className="text-muted-foreground">
              {conversationStatusLabels[conversation.status]}
            </span>
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

      <section className="grid gap-3" aria-labelledby="waiting-heading">
        <div className="grid gap-1">
          <h2 id="waiting-heading" className="text-lg font-semibold">
            Waiting for the team
          </h2>
          <p className="text-sm text-muted-foreground">
            Customers the assistant handed over, and conversations someone has
            taken over.
          </p>
        </div>
        <ConversationList
          conversations={waiting.data ?? []}
          slug={business.slug}
          timeZone={business.timezone}
          empty="Nobody is waiting."
        />
      </section>

      <section className="grid gap-3" aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="text-lg font-semibold">
          Recent conversations
        </h2>
        <ConversationList
          conversations={recent.data ?? []}
          slug={business.slug}
          timeZone={business.timezone}
          empty="No conversations from your website yet."
        />
      </section>
    </>
  );
}
