import type { Metadata } from "next";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import {
  addClosure,
  addTimeOff,
  removeClosure,
  removeTimeOff,
} from "@/app/(app)/dashboard/b/[slug]/time-off/actions";
import {
  ClosureForm,
  TimeOffForm,
} from "@/app/(app)/dashboard/b/[slug]/time-off/time-off-forms";
import { ActionButton } from "@/components/action-button";
import { requireMemberBusiness } from "@/lib/business";
import { formatDay, formatLocalDateTime, nowIso, todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "Time off" };

export default async function TimeOffPage({
  params,
}: PageProps<"/dashboard/b/[slug]/time-off">) {
  const { slug } = await params;
  const { supabase, business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/time-off`,
  );

  // Only what hasn't ended yet. Through RLS as the user: members see their business's.
  const [closuresResult, timeOffResult, staffResult] = await Promise.all([
    supabase
      .from("closures")
      .select("id, starts_on, ends_on, reason")
      .eq("business_id", business.id)
      .gte("ends_on", todayIn(business.timezone))
      .order("starts_on"),
    supabase
      .from("time_off")
      .select("id, starts_at, ends_at, reason, staff (name)")
      .eq("business_id", business.id)
      .gt("ends_at", nowIso())
      .order("starts_at"),
    supabase
      .from("staff")
      .select("id, name")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("created_at"),
  ]);
  for (const { error } of [closuresResult, timeOffResult, staffResult]) {
    if (error) throw new Error(`Could not load time off: ${error.message}`);
  }
  const closures = closuresResult.data ?? [];
  const timeOff = timeOffResult.data ?? [];
  const canManage = role !== "staff";
  const zone = business.timezone.replaceAll("_", " ");

  return (
    <>
      <BusinessHeader business={business} role={role} current="time-off" />

      <section className="grid gap-3" aria-labelledby="closures-heading">
        <div className="grid gap-1">
          <h2 id="closures-heading" className="text-lg font-semibold">
            Closures
          </h2>
          <p className="text-sm text-muted-foreground">
            Whole days the business is closed, such as public holidays.
          </p>
        </div>
        {closures.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No closures coming up.
          </p>
        ) : (
          <ul className="grid gap-2">
            {closures.map((closure) => (
              <li
                key={closure.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <span>
                  {closure.starts_on === closure.ends_on
                    ? formatDay(closure.starts_on)
                    : `${formatDay(closure.starts_on)} to ${formatDay(closure.ends_on)}`}
                  {closure.reason && (
                    <span className="text-muted-foreground" dir="auto">
                      {" "}
                      · {closure.reason}
                    </span>
                  )}
                </span>
                {canManage && (
                  <ActionButton
                    action={removeClosure.bind(null, business.slug, closure.id)}
                    label="Remove"
                    pendingLabel="Removing..."
                    variant="outline"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <ClosureForm action={addClosure.bind(null, business.slug)} />
        )}
      </section>

      <section className="grid gap-3" aria-labelledby="time-off-heading">
        <div className="grid gap-1">
          <h2 id="time-off-heading" className="text-lg font-semibold">
            Staff time off
          </h2>
          <p className="text-sm text-muted-foreground">
            When someone is away. Times are in {zone} time.
          </p>
        </div>
        {timeOff.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No time off coming up.
          </p>
        ) : (
          <ul className="grid gap-2">
            {timeOff.map((entry) => (
              <li
                key={entry.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border p-3 text-sm"
              >
                <span className="grid gap-0.5">
                  <span className="font-medium" dir="auto">
                    {entry.staff.name}
                  </span>
                  <span>
                    {formatLocalDateTime(entry.starts_at, business.timezone)} to{" "}
                    {formatLocalDateTime(entry.ends_at, business.timezone)}
                  </span>
                  {entry.reason && (
                    <span className="text-muted-foreground" dir="auto">
                      {entry.reason}
                    </span>
                  )}
                </span>
                {canManage && (
                  <ActionButton
                    action={removeTimeOff.bind(null, business.slug, entry.id)}
                    label="Remove"
                    pendingLabel="Removing..."
                    variant="outline"
                  />
                )}
              </li>
            ))}
          </ul>
        )}
        {canManage && (
          <TimeOffForm
            action={addTimeOff.bind(null, business.slug)}
            staff={staffResult.data ?? []}
          />
        )}
      </section>
    </>
  );
}
