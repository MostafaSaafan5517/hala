import { ArrowLeft } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { updateStaffMember } from "@/app/(app)/dashboard/b/[slug]/staff/actions";
import { StaffForm } from "@/app/(app)/dashboard/b/[slug]/staff/staff-form";
import { buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireMemberBusiness } from "@/lib/business";

export const metadata: Metadata = { title: "Edit staff member" };

export default async function EditStaffMemberPage({
  params,
}: PageProps<"/dashboard/b/[slug]/staff/[staffId]">) {
  const { slug, staffId } = await params;
  const { supabase, business } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/staff/${staffId}`,
    ["owner", "admin"],
  );

  const [staffResult, servicesResult] = await Promise.all([
    supabase
      .from("staff")
      .select("name, staff_services (service_id)")
      .eq("id", staffId)
      .eq("business_id", business.id)
      .maybeSingle(),
    supabase
      .from("services")
      .select("id, name_en, name_ar, active")
      .eq("business_id", business.id)
      .order("created_at"),
  ]);
  // A malformed id is just a staff member that doesn't exist.
  if (staffResult.error && staffResult.error.code !== "22P02") {
    throw new Error(
      `Could not load the staff member: ${staffResult.error.message}`,
    );
  }
  if (servicesResult.error) {
    throw new Error(`Could not load services: ${servicesResult.error.message}`);
  }
  const person = staffResult.data;
  if (!person) notFound();

  const chosen = person.staff_services.map(({ service_id }) => service_id);
  // Active services, plus any archived one this person still performs, so saving keeps it
  // unless it's unticked.
  const services = servicesResult.data.filter(
    (service) => service.active || chosen.includes(service.id),
  );

  return (
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <Link
        href={`/dashboard/b/${business.slug}/staff`}
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "justify-self-start",
        })}
      >
        <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
        Staff
      </Link>
      <Card>
        <CardHeader>
          <CardTitle as="h1">Edit staff member</CardTitle>
          <CardDescription>
            Changes apply to new bookings; existing ones stay as booked.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <StaffForm
            action={updateStaffMember.bind(null, business.slug, staffId)}
            initial={{ name: person.name, serviceIds: chosen }}
            services={services}
            submitLabel="Save staff member"
            pendingLabel="Saving..."
          />
        </CardContent>
      </Card>
    </div>
  );
}
