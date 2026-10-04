import type { Metadata } from "next";
import Link from "next/link";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { setStaffActive } from "@/app/(app)/dashboard/b/[slug]/staff/actions";
import { ActionButton } from "@/components/action-button";
import { ServiceName } from "@/components/service-name";
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
      "id, name, active, staff_services (services (id, name_en, name_ar))",
    )
    .eq("business_id", business.id)
    .order("active", { ascending: false })
    .order("created_at");
  if (error) throw new Error(`Could not load staff: ${error.message}`);

  const canManage = role !== "staff";

  return (
    <>
      <BusinessHeader business={business} role={role} current="staff" />

      <section className="grid gap-3" aria-labelledby="staff-heading">
        <div className="flex items-center justify-between gap-4">
          <h2 id="staff-heading" className="text-lg font-semibold">
            Staff
          </h2>
          {canManage && (
            <Link
              href={`/dashboard/b/${business.slug}/staff/new`}
              className={buttonVariants({ variant: "outline" })}
            >
              New staff member
            </Link>
          )}
        </div>

        {staff.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No staff yet. Add the people customers book with, and the services
            each of them performs.
          </p>
        ) : (
          <ul className="grid gap-3">
            {staff.map((person) => (
              <li
                key={person.id}
                className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-start"
              >
                <div className="grid min-w-0 gap-1">
                  <p className="flex flex-wrap items-center gap-2">
                    <span className="font-medium" dir="auto">
                      {person.name}
                    </span>
                    {!person.active && (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                        Archived
                      </span>
                    )}
                  </p>
                  {person.staff_services.length === 0 ? (
                    <span className="text-sm text-muted-foreground">
                      No services yet
                    </span>
                  ) : (
                    <ul
                      aria-label={`Services ${person.name} performs`}
                      className="flex flex-wrap gap-1.5"
                    >
                      {person.staff_services.map(({ services: service }) => (
                        <li
                          key={service.id}
                          className="rounded-full bg-muted px-2.5 py-1 text-xs"
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
                      className={buttonVariants({ variant: "outline" })}
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
                      variant="outline"
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
