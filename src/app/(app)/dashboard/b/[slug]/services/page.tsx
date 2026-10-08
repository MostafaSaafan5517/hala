import { Archive, Plus, Tag } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { setServiceActive } from "@/app/(app)/dashboard/b/[slug]/services/actions";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import { surfaceList, surfaceRow } from "@/components/surface";
import { buttonVariants } from "@/components/ui/button";
import { requireMemberBusiness } from "@/lib/business";
import { formatDuration } from "@/lib/durations";
import { formatAmount } from "@/lib/money";

export const metadata: Metadata = { title: "Services" };

export default async function ServicesPage({
  params,
}: PageProps<"/dashboard/b/[slug]/services">) {
  const { slug } = await params;
  const { supabase, business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/services`,
  );

  // Through RLS as the user: members see their business's services, archived ones included.
  const { data: services, error } = await supabase
    .from("services")
    .select(
      "id, name_en, name_ar, duration_minutes, buffer_minutes, price, currency, active",
    )
    .eq("business_id", business.id)
    .order("active", { ascending: false })
    .order("created_at");
  if (error) throw new Error(`Could not load services: ${error.message}`);

  const canManage = role !== "staff";
  const newService = canManage && (
    <Link
      href={`/dashboard/b/${business.slug}/services/new`}
      className={buttonVariants()}
    >
      <Plus aria-hidden="true" />
      New service
    </Link>
  );

  return (
    <>
      <BusinessHeader business={business} role={role} current="services" />

      <section className="grid gap-4" aria-labelledby="services-heading">
        <SectionHeader
          id="services-heading"
          title="Services"
          description="What customers can book, each with how long it takes and what it costs."
          // When the list is empty, its empty state offers the action instead.
          action={services.length > 0 && newService}
        />

        {services.length === 0 ? (
          <EmptyState
            icon={<Tag aria-hidden="true" />}
            title="No services yet."
            action={newService}
          >
            Add what customers can book: each one with how long it takes and
            what it costs.
          </EmptyState>
        ) : (
          <ul className={surfaceList}>
            {services.map((service) => (
              <li
                key={service.id}
                className={`${surfaceRow} grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center`}
              >
                <div className="grid min-w-0 gap-1">
                  <p className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                    {service.name_en && (
                      <span className="font-medium" lang="en">
                        {service.name_en}
                      </span>
                    )}
                    {service.name_ar && (
                      <span
                        className={
                          service.name_en
                            ? "text-secondary-foreground"
                            : "font-medium"
                        }
                        lang="ar"
                        dir="rtl"
                      >
                        {service.name_ar}
                      </span>
                    )}
                    {!service.active && (
                      <Badge icon={<Archive aria-hidden="true" />}>
                        Archived
                      </Badge>
                    )}
                  </p>
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-small">
                    <span className="font-medium tabular-nums">
                      {formatAmount(service.price, service.currency)}
                    </span>
                    <span className="text-muted-foreground">
                      {formatDuration(service.duration_minutes)}
                      {service.buffer_minutes > 0 &&
                        ` + ${formatDuration(service.buffer_minutes)} buffer`}
                    </span>
                  </p>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/b/${business.slug}/services/${service.id}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      Edit
                    </Link>
                    {/* Archiving stops new bookings; existing ones stay. */}
                    <ActionButton
                      action={setServiceActive.bind(
                        null,
                        business.slug,
                        service.id,
                        !service.active,
                      )}
                      label={service.active ? "Archive" : "Restore"}
                      pendingLabel={
                        service.active ? "Archiving..." : "Restoring..."
                      }
                      variant="ghost"
                      size="sm"
                    />
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
