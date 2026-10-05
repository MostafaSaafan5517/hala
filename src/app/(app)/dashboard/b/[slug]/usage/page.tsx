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
import { buttonVariants } from "@/components/ui/button";
import { BUSINESS_DAILY_BUDGET_USD } from "@/lib/assistant/limits";
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

function StatTile({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 rounded-lg border p-3">
      <dt className="text-sm text-muted-foreground">{label}</dt>
      <dd className="text-2xl font-semibold">{value}</dd>
    </div>
  );
}

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
  const budgetShare = Math.min(1, spentToday / BUSINESS_DAILY_BUDGET_USD);
  const base = `/dashboard/b/${business.slug}/usage`;

  return (
    <>
      <BusinessHeader business={business} role={role} current="usage" />

      <section className="grid gap-4" aria-labelledby="usage-heading">
        <div className="grid gap-1">
          <h2 id="usage-heading" className="text-lg font-semibold">
            The assistant&apos;s usage, last {period} days
          </h2>
          <p className="text-sm text-muted-foreground">
            Costs are worked out from each call&apos;s tokens at the
            model&apos;s list price; the AI Gateway&apos;s own report is the
            bill. Days follow your business&apos;s time zone.
          </p>
        </div>

        <nav aria-label="Period" className="flex gap-2">
          {PERIODS.map((option) => (
            <Link
              key={option}
              href={option === 7 ? base : `${base}?days=${option}`}
              aria-current={option === period ? "page" : undefined}
              className={buttonVariants({
                variant: option === period ? "default" : "outline",
                size: "sm",
              })}
            >
              Last {option} days
            </Link>
          ))}
        </nav>

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <StatTile label="Spent" value={formatUsd(spent)} />
          <StatTile
            label="Website conversations"
            value={formatCount(total((day) => day.conversations))}
          />
          <StatTile
            label="Bookings by the assistant"
            value={formatCount(total((day) => day.bookings))}
          />
          <StatTile
            label="Asked for a person"
            value={formatCount(total((day) => day.person_requests))}
          />
        </dl>

        <div className="grid gap-2 rounded-lg border p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span id="budget-label" className="font-medium">
              Spent today
            </span>
            <span className="tabular-nums">
              {formatUsd(spentToday)} of {formatUsd(BUSINESS_DAILY_BUDGET_USD)}
            </span>
          </div>
          <div
            role="meter"
            aria-labelledby="budget-label"
            aria-valuemin={0}
            aria-valuemax={BUSINESS_DAILY_BUDGET_USD}
            aria-valuenow={spentToday}
            aria-valuetext={`${formatUsd(spentToday)} of ${formatUsd(BUSINESS_DAILY_BUDGET_USD)}`}
            className="h-2 overflow-hidden rounded-full bg-muted"
          >
            <div
              className={cn(
                "h-full rounded-full",
                budgetShare >= 0.8 ? "bg-destructive" : "bg-chart-1",
              )}
              style={{ width: `${budgetShare * 100}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            {budgetShare >= 1
              ? "Today's limit is reached: until midnight, customers get a fixed reply and the conversation goes to your team."
              : budgetShare >= 0.8
                ? "Close to today's limit. When it's reached, customers get a fixed reply and the conversation goes to your team."
                : "The daily limit keeps a busy or abusive day from running up costs."}
          </p>
        </div>
      </section>

      <section className="grid gap-3" aria-labelledby="spend-heading">
        <h2 id="spend-heading" className="text-lg font-semibold">
          Spend per day
        </h2>
        {spent > 0 ? (
          <SpendChart
            days={days.map((day) => ({
              day: day.day,
              cost: day.cost_usd,
              chatCalls: day.chat_calls,
            }))}
          />
        ) : (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            Nothing spent in these days.
          </p>
        )}
      </section>

      {/* The scrolling table is the named region, so the section doesn't repeat its name. */}
      <section className="grid gap-3">
        <h2 id="days-heading" className="text-lg font-semibold">
          Day by day
        </h2>
        <div
          className="overflow-x-auto rounded-lg border"
          tabIndex={0}
          role="region"
          aria-labelledby="days-heading"
        >
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-start text-xs text-muted-foreground">
              <tr>
                <th
                  scope="col"
                  className="px-2 py-2 text-start align-bottom font-medium"
                >
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
                    className="px-2 py-2 text-end align-bottom font-medium"
                  >
                    {heading}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {days.toReversed().map((day) => (
                <tr key={day.day} className="border-t">
                  <th
                    scope="row"
                    className="px-2 py-2 text-start font-normal whitespace-nowrap"
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
                    <td
                      key={index}
                      className="px-2 py-2 text-end whitespace-nowrap tabular-nums"
                    >
                      {value}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid gap-3">
        <h2 id="models-heading" className="text-lg font-semibold">
          By model
        </h2>
        {models.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No model calls in these days.
          </p>
        ) : (
          <div
            className="overflow-x-auto rounded-lg border"
            tabIndex={0}
            role="region"
            aria-labelledby="models-heading"
          >
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-xs text-muted-foreground">
                <tr>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    Model
                  </th>
                  <th scope="col" className="px-3 py-2 text-start font-medium">
                    Used for
                  </th>
                  {["Calls", "Tokens in", "Tokens out", "Spent", "Failed"].map(
                    (heading) => (
                      <th
                        key={heading}
                        scope="col"
                        className="px-3 py-2 text-end font-medium"
                      >
                        {heading}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {models.map((row) => (
                  <tr key={`${row.model}:${row.purpose}`} className="border-t">
                    <th
                      scope="row"
                      dir="ltr"
                      className="px-3 py-2 text-start font-mono text-xs font-normal"
                    >
                      {row.model}
                    </th>
                    <td className="px-3 py-2 whitespace-nowrap">
                      {purposeLabels[row.purpose] ?? row.purpose}
                    </td>
                    {[
                      formatCount(row.calls),
                      formatCount(row.input_tokens),
                      formatCount(row.output_tokens),
                      formatUsd(row.cost_usd),
                      formatCount(row.failed_calls),
                    ].map((value, index) => (
                      <td
                        key={index}
                        className="px-3 py-2 text-end whitespace-nowrap tabular-nums"
                      >
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
