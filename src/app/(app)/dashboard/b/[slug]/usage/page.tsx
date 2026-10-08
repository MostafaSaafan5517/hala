import type { Metadata } from "next";
import Link from "next/link";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import {
  formatCount,
  formatDuration,
  formatRowDay,
  formatUsd,
} from "@/app/(app)/dashboard/b/[slug]/usage/format";
import { SpendChart } from "@/app/(app)/dashboard/b/[slug]/usage/spend-chart";
import { SectionHeader } from "@/components/section-header";
import { surface } from "@/components/surface";
import { businessDailyBudgetUsd } from "@/lib/assistant/limits";
import { requireMemberBusiness } from "@/lib/business";
import { addDays, todayIn } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Usage" };

const PERIODS = [7, 30] as const;

const purposeLabels: Record<string, string> = {
  chat: "Chat",
  search: "Searching the knowledge base",
  index: "Indexing documents",
};

/** One of the period's counts, as a plain figure (DESIGN.md: no row of equal tiles). */
function Figure({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-0.5">
      <dt className="text-small text-muted-foreground">{label}</dt>
      <dd className="text-h2 tabular-nums">{value}</dd>
    </div>
  );
}

/** A table's surface, scrolling sideways on a phone: a named region the keyboard can scroll. */
const tableSurface = `${surface} overflow-x-auto`;
const headCell =
  "px-3 py-2.5 align-bottom text-caption font-medium text-muted-foreground";
const bodyCell = "px-3 py-2.5 whitespace-nowrap tabular-nums";

export default async function UsagePage({
  params,
  searchParams,
}: PageProps<"/dashboard/b/[slug]/usage">) {
  const { slug } = await params;
  const { days: daysParam } = await searchParams;
  const { supabase, business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/usage`,
    ["owner", "admin"],
  );

  const period = daysParam === "30" ? 30 : 7;
  const lastDay = todayIn(business.timezone);
  const range = {
    target_business_id: business.id,
    first_day: addDays(lastDay, -(period - 1)),
    last_day: lastDay,
  };
  // Through RLS as the user; both functions also check the role.
  const [byDay, byModel] = await Promise.all([
    supabase.rpc("usage_by_day", range),
    supabase.rpc("usage_by_model", range),
  ]);
  const error = byDay.error ?? byModel.error;
  if (error) throw new Error(`Could not load usage: ${error.message}`);
  const days = byDay.data ?? [];
  const models = byModel.data ?? [];

  const total = (pick: (day: (typeof days)[number]) => number) =>
    days.reduce((sum, day) => sum + pick(day), 0);
  const spent = total((day) => day.cost_usd);
  const spentToday = days.at(-1)?.cost_usd ?? 0;
  const dailyBudget = businessDailyBudgetUsd();
  const budgetShare = Math.min(1, spentToday / dailyBudget);
  const base = `/dashboard/b/${business.slug}/usage`;

  return (
    <>
      <BusinessHeader business={business} role={role} current="usage" />

      <section className="grid gap-5" aria-labelledby="usage-heading">
        <SectionHeader
          id="usage-heading"
          title={<>The assistant&apos;s usage, last {period} days</>}
          description="Costs are worked out from each call's tokens at the model's list price; the AI Gateway's own report is the bill. Days follow your business's time zone."
          action={
            <nav aria-label="Period" className="flex gap-1.5">
              {PERIODS.map((option) => (
                <Link
                  key={option}
                  href={option === 7 ? base : `${base}?days=${option}`}
                  aria-current={option === period ? "page" : undefined}
                  className={cn(
                    "inline-flex h-9 items-center rounded-full px-3.5 text-small whitespace-nowrap",
                    option === period
                      ? "bg-accent font-medium text-accent-foreground"
                      : "text-secondary-foreground ring-1 ring-border ring-inset hover:bg-muted hover:text-foreground",
                  )}
                >
                  Last {option} days
                </Link>
              ))}
            </nav>
          }
        />

        {/* Today's spend against the budget leads: the one meter on the page. */}
        <div className={`${surface} grid gap-3 p-5 sm:p-6`}>
          <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
            <span id="budget-label" className="text-large font-semibold">
              Spent today
            </span>
            <span className="text-h3 tabular-nums">
              {formatUsd(spentToday)}{" "}
              <span className="text-body font-normal text-muted-foreground">
                of {formatUsd(dailyBudget)}
              </span>
            </span>
          </div>
          <div
            role="meter"
            aria-labelledby="budget-label"
            aria-valuemin={0}
            aria-valuemax={dailyBudget}
            aria-valuenow={spentToday}
            aria-valuetext={`${formatUsd(spentToday)} of ${formatUsd(dailyBudget)}`}
            className="h-2.5 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full rounded-full",
                budgetShare >= 0.8 ? "bg-destructive" : "bg-chart-1",
              )}
              style={{ width: `${budgetShare * 100}%` }}
            />
          </div>
          <p className="text-small text-secondary-foreground">
            {budgetShare >= 1
              ? "Today's limit is reached: until midnight, customers get a fixed reply and the conversation goes to your team."
              : budgetShare >= 0.8
                ? "Close to today's limit. When it's reached, customers get a fixed reply and the conversation goes to your team."
                : "The daily limit keeps a busy or abusive day from running up costs."}
          </p>
        </div>

        <dl className="flex flex-wrap gap-x-12 gap-y-4 px-1">
          <Figure label="Spent" value={formatUsd(spent)} />
          <Figure
            label="Website conversations"
            value={formatCount(total((day) => day.conversations))}
          />
          <Figure
            label="Bookings by the assistant"
            value={formatCount(total((day) => day.bookings))}
          />
          <Figure
            label="Asked for a person"
            value={formatCount(total((day) => day.person_requests))}
          />
        </dl>
      </section>

      <section className="grid gap-4" aria-labelledby="spend-heading">
        <SectionHeader id="spend-heading" title="Spend per day" />
        {spent > 0 ? (
          <div className={`${surface} p-5 sm:p-6`}>
            <SpendChart
              days={days.map((day) => ({
                day: day.day,
                cost: day.cost_usd,
                chatCalls: day.chat_calls,
              }))}
            />
          </div>
        ) : (
          <p className="text-secondary-foreground">
            Nothing spent in these days.
          </p>
        )}
      </section>

      {/* The scrolling table is the named region, so the section doesn't repeat its name. */}
      <section className="grid gap-4">
        <h2 id="days-heading" className="text-h2">
          Day by day
        </h2>
        <div
          className={tableSurface}
          tabIndex={0}
          role="region"
          aria-labelledby="days-heading"
        >
          <table className="w-full text-small">
            <thead>
              <tr>
                <th scope="col" className={`${headCell} text-start`}>
                  Day
                </th>
                {[
                  "Conversations",
                  "Chat calls",
                  "Spent",
                  "Median call",
                  "Slowest 5%",
                  "Bookings",
                  "Refused or declined",
                  "Asked for a person",
                  "Failed calls",
                ].map((heading) => (
                  <th
                    key={heading}
                    scope="col"
                    className={`${headCell} text-end`}
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.toReversed().map((day) => (
                <tr key={day.day} className="border-t hover:bg-muted">
                  <th
                    scope="row"
                    className="px-3 py-2.5 text-start font-normal whitespace-nowrap"
                  >
                    {formatRowDay(day.day)}
                  </th>
                  {[
                    formatCount(day.conversations),
                    formatCount(day.chat_calls),
                    formatUsd(day.cost_usd),
                    formatDuration(day.chat_latency_p50_ms),
                    formatDuration(day.chat_latency_p95_ms),
                    formatCount(day.bookings),
                    formatCount(
                      day.failed_tool_calls + day.declined_tool_calls,
                    ),
                    formatCount(day.person_requests),
                    formatCount(day.failed_model_calls),
                  ].map((value, index) => (
                    <td key={index} className={`${bodyCell} text-end`}>
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-4">
        <h2 id="models-heading" className="text-h2">
          By model
        </h2>
        {models.length === 0 ? (
          <p className="text-secondary-foreground">
            No model calls in these days.
          </p>
        ) : (
          <div
            className={tableSurface}
            tabIndex={0}
            role="region"
            aria-labelledby="models-heading"
          >
            <table className="w-full text-small">
              <thead>
                <tr>
                  <th scope="col" className={`${headCell} text-start`}>
                    Model
                  </th>
                  <th scope="col" className={`${headCell} text-start`}>
                    Used for
                  </th>
                  {["Calls", "Tokens in", "Tokens out", "Spent", "Failed"].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className={`${headCell} text-end`}
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {models.map((row) => (
                  <tr
                    key={`${row.model}:${row.purpose}`}
                    className="border-t hover:bg-muted"
                  >
                    <th
                      scope="row"
                      dir="ltr"
                      className="px-3 py-2.5 text-start font-mono text-caption font-normal"
                    >
                      {row.model}
                    </th>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      {purposeLabels[row.purpose] ?? row.purpose}
                    </td>
                    {[
                      formatCount(row.calls),
                      formatCount(row.input_tokens),
                      formatCount(row.output_tokens),
                      formatUsd(row.cost_usd),
                      formatCount(row.failed_calls),
                    ].map((value, index) => (
                      <td key={index} className={`${bodyCell} text-end`}>
                        {value}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </>
  );
}
