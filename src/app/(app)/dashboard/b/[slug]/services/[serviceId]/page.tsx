import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { updateService } from "@/app/(app)/dashboard/b/[slug]/services/actions";
import { ServiceForm } from "@/app/(app)/dashboard/b/[slug]/services/service-form";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { requireMemberBusiness } from "@/lib/business";
import { amountToInput, PRICE_CURRENCIES } from "@/lib/money";

export const metadata: Metadata = { title: "Edit service" };

export default async function EditServicePage({
  params,
}: PageProps<"/dashboard/b/[slug]/services/[serviceId]">) {
  const { slug, serviceId } = await params;
  const { supabase, business } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/services/${serviceId}`,
    ["owner", "admin"],
  );

  const { data: service, error } = await supabase
    .from("services")
    .select(
      "name_en, name_ar, duration_minutes, buffer_minutes, price, currency",
    )
    .eq("id", serviceId)
    .eq("business_id", business.id)
    .maybeSingle();
  // A malformed id is just a service that doesn't exist.
  if (error && error.code !== "22P02") {
    throw new Error(`Could not load the service: ${error.message}`);
  }
  if (!service) notFound();

  // A currency the business used before the list changed stays available for this service.
  const currencies = PRICE_CURRENCIES.includes(
    service.currency as (typeof PRICE_CURRENCIES)[number],
  )
    ? PRICE_CURRENCIES
    : [...PRICE_CURRENCIES, service.currency];

  return (
    <Card className="mx-auto w-full max-w-xl">
      <CardHeader>
        <CardTitle>Edit service</CardTitle>
        <CardDescription>
          Changes apply to new bookings; existing ones keep what was booked.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <ServiceForm
          action={updateService.bind(null, business.slug, serviceId)}
          initial={{
            nameEn: service.name_en ?? "",
            nameAr: service.name_ar ?? "",
            duration: String(service.duration_minutes),
            buffer: String(service.buffer_minutes),
            price: amountToInput(service.price, service.currency),
            currency: service.currency,
          }}
          currencies={currencies}
          submitLabel="Save service"
          pendingLabel="Saving..."
        />
      </CardContent>
    </Card>
  );
}
