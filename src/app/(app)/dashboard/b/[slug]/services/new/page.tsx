import { ArrowLeft } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { createService } from "@/app/(app)/dashboard/b/[slug]/services/actions";
import { ServiceForm } from "@/app/(app)/dashboard/b/[slug]/services/service-form";
import { buttonVariants } from "@/components/ui/button";
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
    <div className="mx-auto grid w-full max-w-2xl gap-4">
      <Link
        href={`/dashboard/b/${business.slug}/services`}
        className={buttonVariants({
          variant: "ghost",
          size: "sm",
          className: "justify-self-start",
        })}
      >
        <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
        Services
      </Link>
      <Card>
        <CardHeader>
          <CardTitle as="h1">New service</CardTitle>
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
    </div>
  );
}
