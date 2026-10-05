"use client";

import { useState } from "react";
import {
  formatCount,
  formatShortDay,
  formatUsd,
  niceCeiling,
} from "@/app/(app)/dashboard/b/[slug]/usage/format";
import { formatDay } from "@/lib/dates";
import { cn } from "@/lib/utils";

type DaySpend = { day: string; cost: number; chatCalls: number };

/**
 * Spend per day as columns from one baseline. Hovering a day, or moving through the days with
 * the arrow keys, shows its spend and chat calls; the table below the chart lists every value,
 * so nothing is only reachable here.
 */
export function SpendChart({ days }: { days: DaySpend[] }) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceCeiling(Math.max(...days.map((day) => day.cost)));
  const ticks = [top, top / 2, 0];
  const shown = active === null ? null : days[active];

  function readout(day: DaySpend) {
    return `${formatDay(day.day)}: ${formatUsd(day.cost)}, ${formatCount(day.chatCalls)} chat ${day.chatCalls === 1 ? "call" : "calls"}`;
  }

  return (
    <div
      role="group"
      aria-label="Spend per day. Use the arrow keys to read each day; the table below lists every value."
      tabIndex={0}
      className="grid gap-2 rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-ring"
      onFocus={() => setActive((current) => current ?? days.length - 1)}
      onBlur={() => setActive(null)}
      onPointerLeave={() => setActive(null)}
      onKeyDown={(event) => {
        const moves: Record<string, number> = {
          ArrowLeft: -1,
          ArrowRight: 1,
          Home: -days.length,
          End: days.length,
        };
        const move = moves[event.key];
        if (move === undefined) return;
        event.preventDefault();
        setActive((current) =>
          Math.min(
            days.length - 1,
            Math.max(0, (current ?? days.length - 1) + move),
          ),
        );
      }}
    >
      <div className="relative h-44 ps-16">
        {ticks.map((tick, index) => (
          <div
            key={index}
            aria-hidden="true"
            className="absolute inset-x-0 flex items-center"
            style={{ top: `${(index / (ticks.length - 1)) * 100}%` }}
          >
            <span className="w-16 -translate-y-1/2 pe-2 text-end text-xs text-muted-foreground tabular-nums">
              {formatUsd(tick)}
            </span>
            <span className="h-px flex-1 -translate-y-1/2 bg-border" />
          </div>
        ))}

        <div className="relative flex h-full items-end">
          {days.map((day, index) => {
            const height = top === 0 ? 0 : (day.cost / top) * 100;
            return (
              <div
                key={day.day}
                aria-hidden="true"
                className="flex h-full flex-1 items-end justify-center px-px"
                onPointerEnter={() => setActive(index)}
              >
                <div
                  className={cn(
                    "w-full max-w-6 rounded-t bg-chart-1 transition-opacity",
                    active === index && "opacity-70",
                  )}
                  style={{
                    height: day.cost > 0 ? `max(${height}%, 2px)` : 0,
                  }}
                />
              </div>
            );
          })}

          {shown && active !== null && (
            <div
              aria-hidden="true"
              className={cn(
                "pointer-events-none absolute bottom-full z-10 mb-2 grid gap-0.5 rounded-md border bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap text-popover-foreground shadow-md",
                active < days.length * 0.2
                  ? "translate-x-0"
                  : active > days.length * 0.8
                    ? "-translate-x-full"
                    : "-translate-x-1/2",
              )}
              style={{ left: `${((active + 0.5) / days.length) * 100}%` }}
            >
              <span className="text-sm font-semibold tabular-nums">
                {formatUsd(shown.cost)}
              </span>
              <span className="text-muted-foreground">
                {formatDay(shown.day)} · {formatCount(shown.chatCalls)} chat{" "}
                {shown.chatCalls === 1 ? "call" : "calls"}
              </span>
            </div>
          )}
        </div>
      </div>

      <div
        aria-hidden="true"
        className="flex justify-between ps-16 text-xs text-muted-foreground"
      >
        {[
          days[0],
          days[Math.floor((days.length - 1) / 2)],
          days[days.length - 1],
        ].map((day, index) => (
          <span key={index}>{day ? formatShortDay(day.day) : ""}</span>
        ))}
      </div>

      <p aria-live="polite" className="sr-only">
        {shown ? readout(shown) : ""}
      </p>
    </div>
  );
}
