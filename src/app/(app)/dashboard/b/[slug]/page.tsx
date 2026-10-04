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

      <section className="grid gap-3" aria-labelledby="details-heading">
        <h2 id="details-heading" className="text-lg font-semibold">
          Details
        </h2>
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
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="rules-heading">
        <div className="grid gap-1">
          <h2 id="rules-heading" className="text-lg font-semibold">
            Booking rules
          </h2>
          <p className="text-sm text-muted-foreground">
            The assistant follows these for every booking, whatever a customer
            asks for.
          </p>
        </div>
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
          <dl className="grid gap-x-6 gap-y-2 rounded-lg border p-4 text-sm sm:grid-cols-[auto_1fr]">
            <dt className="text-muted-foreground">Book how soon</dt>
            <dd>{describeNotice(business.booking_notice_minutes)}</dd>
            <dt className="text-muted-foreground">Book how far ahead</dt>
            <dd>Up to {business.booking_horizon_days} days</dd>
            <dt className="text-muted-foreground">Appointments start</dt>
            <dd>{describeSlotInterval(business.slot_interval_minutes)}</dd>
            <dt className="text-muted-foreground">Cancel or move a booking</dt>
            <dd>{describeCancellation(business.cancellation_notice_hours)}</dd>
          </dl>
        )}
      </section>
    </>
  );
}
