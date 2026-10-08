import type { Metadata } from "next";
import Link from "next/link";
import { startTestConversation } from "@/app/(app)/dashboard/b/[slug]/assistant/actions";
import { ConversationStatusBadge } from "@/app/(app)/dashboard/b/[slug]/conversation-status";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { ActionButton } from "@/components/action-button";
import { SectionHeader } from "@/components/section-header";
import { surface, surfaceLinkRow, surfaceList } from "@/components/surface";
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

      <div className="grid items-start gap-10 lg:grid-cols-2">
        <section
          className={`${surface} grid gap-4 p-5 sm:p-6`}
          aria-labelledby="assistant-heading"
        >
          <div className="grid gap-1">
            <h2 id="assistant-heading" className="text-h2">
              Test the assistant
            </h2>
            <p className="text-secondary-foreground">
              Chat with it as a customer would. It answers from your knowledge
              base and books for real, so bookings you confirm here appear on
              the Bookings tab.
            </p>
          </div>
          <ActionButton
            action={startTestConversation.bind(null, business.slug)}
            label="Start a test conversation"
            pendingLabel="Starting..."
          />
        </section>

        <section className="grid gap-4" aria-labelledby="recent-heading">
          <SectionHeader
            id="recent-heading"
            title="Recent test conversations"
          />
          {conversations.length === 0 ? (
            <p className="text-secondary-foreground">None yet.</p>
          ) : (
            <ul className={surfaceList}>
              {conversations.map((conversation) => (
                <li key={conversation.id}>
                  <Link
                    href={`/dashboard/b/${business.slug}/assistant/${conversation.id}`}
                    className={`${surfaceLinkRow} flex flex-wrap items-center justify-between gap-3`}
                  >
                    <span className="tabular-nums">
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
                    <ConversationStatusBadge status={conversation.status} />
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
