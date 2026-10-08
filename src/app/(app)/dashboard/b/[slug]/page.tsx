import type { Metadata } from "next";
import {
  updateDetails,
  updateRules,
} from "@/app/(app)/dashboard/b/[slug]/actions";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import {
  DetailsForm,
  RulesForm,
} from "@/app/(app)/dashboard/b/[slug]/settings-forms";
import { SectionHeader } from "@/components/section-header";
import { surface } from "@/components/surface";
import {
  describeCancellation,
  describeNotice,
  describeSlotInterval,
} from "@/lib/booking-rules";
import { requireMemberBusiness } from "@/lib/business";
import { languageNames } from "@/lib/languages";
import { timeZoneOptions } from "@/lib/time-zones";

export const metadata: Metadata = { title: "Business" };

export default async function BusinessPage({
  params,
}: PageProps<"/dashboard/b/[slug]">) {
  const { slug } = await params;
  const { business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}`,
  );
  const canManage = role !== "staff";

  return (
    <>
      <BusinessHeader business={business} role={role} current="overview" />

      <div className="grid items-start gap-10 lg:grid-cols-2">
        <section className="grid gap-4" aria-labelledby="details-heading">
          <SectionHeader
            id="details-heading"
            title="Details"
            description="How customers and the assistant know the business."
          />
          {canManage ? (
            <DetailsForm
              action={updateDetails.bind(null, business.slug)}
              details={{
                name: business.name,
                timezone: business.timezone,
                defaultLanguage: business.default_language,
              }}
              timeZones={timeZoneOptions()}
            />
          ) : (
            <dl
              className={`${surface} grid gap-x-8 gap-y-3 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-6`}
            >
              <dt className="text-small text-muted-foreground">Time zone</dt>
              <dd>{business.timezone.replaceAll("_", " ")}</dd>
              <dt className="text-small text-muted-foreground">
                Assistant&apos;s first language
              </dt>
              <dd lang={business.default_language}>
                {languageNames[business.default_language]}
              </dd>
            </dl>
          )}
        </section>

        <section className="grid gap-4" aria-labelledby="rules-heading">
          <SectionHeader
            id="rules-heading"
            title="Booking rules"
            description="The assistant follows these for every booking, whatever a customer asks for."
          />
          {canManage ? (
            <RulesForm
              action={updateRules.bind(null, business.slug)}
              rules={{
                noticeMinutes: business.booking_notice_minutes,
                horizonDays: business.booking_horizon_days,
                slotInterval: business.slot_interval_minutes,
                cancellationHours: business.cancellation_notice_hours,
              }}
            />
          ) : (
            <dl
              className={`${surface} grid gap-x-8 gap-y-3 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-6`}
            >
              <dt className="text-small text-muted-foreground">
                Book how soon
              </dt>
              <dd>{describeNotice(business.booking_notice_minutes)}</dd>
              <dt className="text-small text-muted-foreground">
                Book how far ahead
              </dt>
              <dd>Up to {business.booking_horizon_days} days</dd>
              <dt className="text-small text-muted-foreground">
                Appointments start
              </dt>
              <dd>{describeSlotInterval(business.slot_interval_minutes)}</dd>
              <dt className="text-small text-muted-foreground">
                Cancel or move a booking
              </dt>
              <dd>
                {describeCancellation(business.cancellation_notice_hours)}
              </dd>
            </dl>
          )}
        </section>
      </div>
    </>
  );
}
