import type { Metadata } from "next";
import Link from "next/link";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { setServiceActive } from "@/app/(app)/dashboard/b/[slug]/services/actions";
import { ActionButton } from "@/components/action-button";
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

  return (
    <>
      <BusinessHeader business={business} role={role} current="services" />

      <section className="grid gap-3" aria-labelledby="services-heading">
        <div className="flex items-center justify-between gap-4">
          <h2 id="services-heading" className="text-lg font-semibold">
            Services
          </h2>
          {canManage && (
            <Link
              href={`/dashboard/b/${business.slug}/services/new`}
              className={buttonVariants({ variant: "outline" })}
            >
              New service
            </Link>
          )}
        </div>

        {services.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No services yet. Add what customers can book: each one with how long
            it takes and what it costs.
          </p>
        ) : (
          <ul className="grid gap-3">
            {services.map((service) => (
              <li
                key={service.id}
                className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_auto] sm:items-start"
              >
                <div className="grid min-w-0 gap-1">
                  {service.name_en && (
                    <span className="font-medium" lang="en">
                      {service.name_en}
                    </span>
                  )}
                  {service.name_ar && (
                    <span
                      className={
                        service.name_en
                          ? "text-muted-foreground"
                          : "font-medium"
                      }
                      lang="ar"
                      dir="rtl"
                    >
                      {service.name_ar}
                    </span>
                  )}
                  <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm">
                    <span>{formatAmount(service.price, service.currency)}</span>
                    <span className="text-muted-foreground">
                      {formatDuration(service.duration_minutes)}
                      {service.buffer_minutes > 0 &&
                        ` + ${formatDuration(service.buffer_minutes)} buffer`}
                    </span>
                    {!service.active && (
                      <span className="rounded-full bg-muted px-2.5 py-1 text-xs text-muted-foreground">
                        Archived
                      </span>
                    )}
                  </p>
                </div>
                {canManage && (
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={`/dashboard/b/${business.slug}/services/${service.id}`}
                      className={buttonVariants({ variant: "outline" })}
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
