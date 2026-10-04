import type { Metadata } from "next";
import { createStaffMember } from "@/app/(app)/dashboard/b/[slug]/staff/actions";
import { StaffForm } from "@/app/(app)/dashboard/b/[slug]/staff/staff-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireMemberBusiness } from "@/lib/business";

export const metadata: Metadata = { title: "New staff member" };

export default async function NewStaffMemberPage({
  params,
}: PageProps<"/dashboard/b/[slug]/staff/new">) {
  const { slug } = await params;
  const { supabase, business } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/staff/new`,
    ["owner", "admin"],
  );

  const { data: services, error } = await supabase
    .from("services")
    .select("id, name_en, name_ar, active")
    .eq("business_id", business.id)
    .eq("active", true)
    .order("created_at");
  if (error) throw new Error(`Could not load services: ${error.message}`);

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle>New staff member</CardTitle>
        <CardDescription>
          Someone customers can book at {business.name}. They don&apos;t need an
          account.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <StaffForm
          action={createStaffMember.bind(null, business.slug)}
          initial={{ serviceIds: [] }}
          services={services}
          submitLabel="Add staff member"
          pendingLabel="Adding..."
        />
      </CardContent>
    </Card>
  );
}
