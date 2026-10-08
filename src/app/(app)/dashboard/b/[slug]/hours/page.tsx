import type { Metadata } from "next";
import Link from "next/link";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { setHours } from "@/app/(app)/dashboard/b/[slug]/hours/actions";
import { WeekEditor } from "@/app/(app)/dashboard/b/[slug]/hours/week-editor";
import { SectionHeader } from "@/components/section-header";
import { surfaceList } from "@/components/surface";
import { requireMemberBusiness } from "@/lib/business";
import { type Span, WEEKDAYS } from "@/lib/hours";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Hours" };

/** "HH:MM:SS" from Postgres as "HH:MM". */
function shortTime(time: string) {
  return time.slice(0, 5);
}

function WeekSummary({ spans }: { spans: Span[] }) {
  return (
    <dl className={`${surfaceList} max-w-2xl`}>
      {WEEKDAYS.map((dayName, weekday) => {
        const daySpans = spans.filter((span) => span.weekday === weekday);
        return (
          <div
            key={dayName}
            className="grid grid-cols-[8rem_minmax(0,1fr)] gap-4 px-4 py-3 sm:px-5"
          >
            <dt className="font-medium">{dayName}</dt>
            <dd
              className={
                daySpans.length === 0 ? "text-muted-foreground" : "tabular-nums"
              }
            >
              {daySpans.length === 0
                ? "Closed"
                : daySpans
                    .map((span) => `${span.opensAt}-${span.closesAt}`)
                    .join(", ")}
            </dd>
          </div>
        );
      })}
    </dl>
  );
}

export default async function HoursPage({
  params,
  searchParams,
}: PageProps<"/dashboard/b/[slug]/hours">) {
  const { slug } = await params;
  const { staff: staffParam } = await searchParams;
  const { supabase, business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/hours`,
  );

  // Through RLS as the user: members see all of their business's schedules.
  const [hoursResult, staffResult] = await Promise.all([
    supabase
      .from("working_hours")
      .select("staff_id, weekday, opens_at, closes_at")
      .eq("business_id", business.id)
      .order("weekday")
      .order("opens_at"),
    supabase
      .from("staff")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("created_at"),
  ]);
  if (hoursResult.error) {
    throw new Error(`Could not load hours: ${hoursResult.error.message}`);
  }
  if (staffResult.error) {
    throw new Error(`Could not load staff: ${staffResult.error.message}`);
  }

  const spansOf = (staffId: string | null): Span[] =>
    hoursResult.data
      .filter((row) => row.staff_id === staffId)
      .map((row) => ({
        weekday: row.weekday,
        opensAt: shortTime(row.opens_at),
        closesAt: shortTime(row.closes_at),
      }));
  const businessSpans = spansOf(null);
  const selected = staffResult.data.find((person) => person.id === staffParam);
  const canManage = role !== "staff";
  const choices = [
    { id: null, label: "Business hours", href: "" },
    ...staffResult.data.map((person) => ({
      id: person.id,
      label: person.name,
      href: `?staff=${person.id}`,
    })),
  ];

  return (
    <>
      <BusinessHeader business={business} role={role} current="hours" />

      <section className="grid gap-4" aria-labelledby="hours-heading">
        <SectionHeader
          id="hours-heading"
          title={
            selected ? (
              <>
                <span dir="auto">{selected.name}</span>&apos;s hours
              </>
            ) : (
              "Business hours"
            )
          }
          description={
            selected
              ? "Staff work the business's hours unless they have their own."
              : `In ${business.timezone.replaceAll("_", " ")} time. Staff work these hours unless they have their own.`
          }
        />
        <nav aria-label="Whose hours" className="flex flex-wrap gap-1.5">
          {choices.map((choice) => {
            const current = (selected?.id ?? null) === choice.id;
            return (
              <Link
                key={choice.id ?? "business"}
                href={`/dashboard/b/${business.slug}/hours${choice.href}`}
                aria-current={current ? "page" : undefined}
                dir="auto"
                className={cn(
                  "inline-flex h-9 items-center rounded-full px-3.5 text-small",
                  current
                    ? "bg-accent font-medium text-accent-foreground"
                    : "text-secondary-foreground ring-1 ring-border ring-inset hover:bg-muted hover:text-foreground",
                )}
              >
                {choice.label}
                {choice.id && spansOf(choice.id).length > 0 && " (own hours)"}
              </Link>
            );
          })}
        </nav>

        {canManage ? (
          <WeekEditor
            // A fresh editor for each schedule.
            key={selected?.id ?? "business"}
            action={setHours.bind(null, business.slug, selected?.id ?? null)}
            spans={spansOf(selected?.id ?? null)}
            businessSpans={selected ? businessSpans : undefined}
            staffName={selected?.name}
          />
        ) : (
          <WeekSummary
            spans={
              selected && spansOf(selected.id).length > 0
                ? spansOf(selected.id)
                : businessSpans
            }
          />
        )}
      </section>
    </>
  );
}
