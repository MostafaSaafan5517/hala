import type { Metadata } from "next";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { requireMemberBusiness } from "@/lib/business";
import { languageNames } from "@/lib/languages";

export const metadata: Metadata = { title: "Business" };

export default async function BusinessPage({
  params,
}: PageProps<"/dashboard/b/[slug]">) {
  const { slug } = await params;
  const { business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}`,
  );

  return (
    <>
      <BusinessHeader business={business} role={role} current="overview" />

      <section className="grid gap-3" aria-labelledby="details-heading">
        <h2 id="details-heading" className="text-lg font-semibold">
          Details
        </h2>
        <dl className="grid gap-x-6 gap-y-2 rounded-lg border p-4 text-sm sm:grid-cols-[auto_1fr]">
          <dt className="text-muted-foreground">Time zone</dt>
          <dd>{business.timezone.replaceAll("_", " ")}</dd>
          <dt className="text-muted-foreground">
            Assistant&apos;s first language
          </dt>
          <dd lang={business.default_language}>
            {languageNames[business.default_language]}
          </dd>
        </dl>
      </section>
    </>
  );
}
