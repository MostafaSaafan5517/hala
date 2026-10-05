import type { Metadata } from "next";
import Link from "next/link";
import { startTestConversation } from "@/app/(app)/dashboard/b/[slug]/assistant/actions";
import { conversationStatusLabels } from "@/app/(app)/dashboard/b/[slug]/conversation-status";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { ActionButton } from "@/components/action-button";
import { requireMemberBusiness } from "@/lib/business";
import { formatLocalDateTime } from "@/lib/dates";

export const metadata: Metadata = { title: "Assistant" };

export default async function AssistantPage({
  params,
}: PageProps<"/dashboard/b/[slug]/assistant">) {
  const { slug } = await params;
  const { supabase, business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/assistant`,
  );

  // Through RLS as the user: members see their business's conversations.
  const { data: conversations, error } = await supabase
    .from("conversations")
    .select("id, status, created_at, starter:profiles!started_by (full_name)")
    .eq("business_id", business.id)
    .eq("channel", "test")
    .order("updated_at", { ascending: false })
    .limit(10);
  if (error) {
    throw new Error(`Could not load conversations: ${error.message}`);
  }

  return (
    <>
      <BusinessHeader business={business} role={role} current="assistant" />

      <section className="grid gap-3" aria-labelledby="assistant-heading">
        <div className="grid gap-1">
          <h2 id="assistant-heading" className="text-lg font-semibold">
            Test the assistant
          </h2>
          <p className="text-sm text-muted-foreground">
            Chat with it as a customer would. It answers from your knowledge
            base and books for real, so bookings you confirm here appear on the
            Bookings tab.
          </p>
        </div>
        <ActionButton
          action={startTestConversation.bind(null, business.slug)}
          label="Start a test conversation"
          pendingLabel="Starting..."
        />
      </section>

      <section className="grid gap-3" aria-labelledby="recent-heading">
        <h2 id="recent-heading" className="text-lg font-semibold">
          Recent test conversations
        </h2>
        {conversations.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            None yet.
          </p>
        ) : (
          <ul className="grid gap-2">
            {conversations.map((conversation) => (
              <li key={conversation.id}>
                <Link
                  href={`/dashboard/b/${business.slug}/assistant/${conversation.id}`}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm hover:bg-muted/50"
                >
                  <span>
                    {formatLocalDateTime(
                      conversation.created_at,
                      business.timezone,
                    )}
                    {conversation.starter?.full_name && (
                      <span className="text-muted-foreground" dir="auto">
                        {" "}
                        · {conversation.starter.full_name}
                      </span>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {conversationStatusLabels[conversation.status]}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
