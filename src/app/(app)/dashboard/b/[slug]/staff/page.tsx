import { Archive, Plus, UserList } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { setStaffActive } from "@/app/(app)/dashboard/b/[slug]/staff/actions";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import { ServiceName } from "@/components/service-name";
import { surfaceList, surfaceRow } from "@/components/surface";
import { buttonVariants } from "@/components/ui/button";
import { requireMemberBusiness } from "@/lib/business";

export const metadata: Metadata = { title: "Staff" };

export default async function StaffPage({
  params,
}: PageProps<"/dashboard/b/[slug]/staff">) {
  const { slug } = await params;
  const { supabase, business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/staff`,
  );

  // Through RLS as the user: members see their business's staff and who performs what.
  const { data: staff, error } = await supabase
    .from("staff")
    .select(
      "id, name, active, staff_services (services (id, name_en, name_ar, created_at))",
    )
    .eq("business_id", business.id)
    .order("active", { ascending: false })
    .order("created_at");
  if (error) throw new Error(`Could not load staff: ${error.message}`);

  const canManage = role !== "staff";
  const newStaffMember = canManage && (
    <Link
      href={`/dashboard/b/${business.slug}/staff/new`}
      className={buttonVariants()}
    >
      <Plus aria-hidden="true" />
      New staff member
    </Link>
  );

  return (
    <>
      <BusinessHeader business={business} role={role} current="staff" />

      <section className="grid gap-4" aria-labelledby="staff-heading">
        <SectionHeader
          id="staff-heading"
          title="Staff"
          description="The people customers book with, and what each of them does."
          // When the list is empty, its empty state offers the action instead.
          action={staff.length > 0 && newStaffMember}
        />

        {staff.length === 0 ? (
          <EmptyState
            icon={<UserList aria-hidden="true" />}
            title="No staff yet."
            action={newStaffMember}
          >
            Add the people customers book with, and the services each of them
            performs.
          </EmptyState>
        ) : (
          <ul className={surfaceList}>
            {staff.map((person) => (
              <li
                key={person.id}
                className={`${surfaceRow} grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center`}
              >
                <div className="grid min-w-0 gap-2">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium" dir="auto">
                      {person.name}
                    </span>
                    {!person.active && (
                      <Badge icon={<Archive aria-hidden="true" />}>
                        Archived
                      </Badge>
                    )}
                  </p>
                  {person.staff_services.length === 0 ? (
                    <span className="text-small text-muted-foreground">
                      No services yet
                    </span>
                  ) : (
                    <ul
                      aria-label={`Services ${person.name} performs`}
                      className="flex flex-wrap gap-1.5"
                    >
                      {person.staff_services
                        .map(({ services: service }) => service)
                        // In the Services tab's order: the database returns links in no order.
                        .toSorted((a, b) =>
                          a.created_at.localeCompare(b.created_at),
                        )
                        .map((service) => (
                          <li
                            key={service.id}
                            className="rounded-full bg-muted px-2.5 py-0.5 text-small text-secondary-foreground"
                          >
                            <ServiceName service={service} />
                          </li>
                        ))}
                    </ul>
                  )}
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/b/${business.slug}/staff/${person.id}`}
                      className={buttonVariants({
                        variant: "outline",
                        size: "sm",
                      })}
                    >
                      Edit
                    </Link>
                    {/* Archiving stops new bookings with them; existing ones stay. */}
                    <ActionButton
                      action={setStaffActive.bind(
                        null,
                        business.slug,
                        person.id,
                        !person.active,
                      )}
                      label={person.active ? "Archive" : "Restore"}
                      pendingLabel={
                        person.active ? "Archiving..." : "Restoring..."
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
