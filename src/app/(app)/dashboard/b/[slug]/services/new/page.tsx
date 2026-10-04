import type { Metadata } from "next";
import { createService } from "@/app/(app)/dashboard/b/[slug]/services/actions";
import { ServiceForm } from "@/app/(app)/dashboard/b/[slug]/services/service-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireMemberBusiness } from "@/lib/business";
import { PRICE_CURRENCIES } from "@/lib/money";

export const metadata: Metadata = { title: "New service" };

export default async function NewServicePage({
  params,
}: PageProps<"/dashboard/b/[slug]/services/new">) {
  const { slug } = await params;
  const { supabase, business } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/services/new`,
    ["owner", "admin"],
  );

  // A business usually prices everything in one currency: start from the one it used last.
  const { data: latest, error } = await supabase
    .from("services")
    .select("currency")
    .eq("business_id", business.id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Could not load services: ${error.message}`);

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle>New service</CardTitle>
        <CardDescription>
          Something customers can book at {business.name}.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ServiceForm
          action={createService.bind(null, business.slug)}
          initial={{ buffer: "0", currency: latest?.currency ?? "USD" }}
          currencies={PRICE_CURRENCIES}
          submitLabel="Add service"
          pendingLabel="Adding..."
        />
      </CardContent>
    </Card>
  );
}
