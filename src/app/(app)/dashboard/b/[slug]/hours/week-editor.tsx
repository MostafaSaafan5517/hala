"use client";

import { X } from "lucide-react";
import { useActionState, useState } from "react";
import type { HoursFormState } from "@/app/(app)/dashboard/b/[slug]/hours/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { type Span, WEEKDAYS } from "@/lib/hours";

type DaySpan = { opensAt: string; closesAt: string };
type Week = DaySpan[][];

const initialState: HoursFormState = { error: null, saved: false };

/** Spans grouped by weekday, closing times as a time input shows them (24:00 as 00:00). */
function toWeek(spans: Span[]): Week {
  return WEEKDAYS.map((_, weekday) =>
    spans
      .filter((span) => span.weekday === weekday)
      .map((span) => ({
        opensAt: span.opensAt,
        closesAt: span.closesAt === "24:00" ? "00:00" : span.closesAt,
      })),
  );
}

/**
 * Edits one weekly schedule. For a staff member, `businessSpans` are the business's hours: the
 * person can work those, or have their own (which start as a copy of the business's).
 */
export function WeekEditor({
  action,
  spans,
  businessSpans,
  staffName,
}: {
  action: (
    previous: HoursFormState,
    formData: FormData,
  ) => Promise<HoursFormState>;
  spans: Span[];
  businessSpans?: Span[];
  staffName?: string;
}) {
  const [state, formAction, pending] = useActionState(action, initialState);
  const isStaff = businessSpans !== undefined;
  const [useBusinessHours, setUseBusinessHours] = useState(
    isStaff && spans.length === 0,
  );
  const [week, setWeek] = useState<Week>(() =>
    toWeek(isStaff && spans.length === 0 ? businessSpans : spans),
  );

  function updateDay(weekday: number, daySpans: DaySpan[]) {
    setWeek((current) =>
      current.map((day, index) => (index === weekday ? daySpans : day)),
    );
  }

  const submitted = week.flatMap((day, weekday) =>
    day.map((span) => ({ weekday, ...span })),
  );

  return (
    <form action={formAction} className="grid gap-4">
      <input type="hidden" name="spans" value={JSON.stringify(submitted)} />
      {isStaff && (
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="useBusinessHours"
            checked={useBusinessHours}
            onChange={(event) => setUseBusinessHours(event.target.checked)}
            className="size-4 accent-primary"
          />
          <span>
            <span dir="auto">{staffName}</span> works the business&apos;s hours
          </span>
        </label>
      )}

      <fieldset
        disabled={useBusinessHours}
        className="grid gap-3 disabled:opacity-60"
      >
        <legend className="sr-only">Hours for each day</legend>
        {WEEKDAYS.map((dayName, weekday) => {
          const daySpans = week[weekday] ?? [];
          return (
            <div
              key={dayName}
              className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[7rem_1fr] sm:items-start"
            >
              <span className="pt-1.5 text-sm font-medium">{dayName}</span>
              <div className="grid gap-2">
                {daySpans.length === 0 && (
                  <span className="pt-1.5 text-sm text-muted-foreground">
                    Closed
                  </span>
                )}
                {daySpans.map((span, index) => (
                  <div
                    key={index}
                    className="grid grid-cols-[minmax(0,9rem)_auto_minmax(0,9rem)_auto] items-center gap-2"
                  >
                    <Input
                      type="time"
                      step={300}
                      aria-label={`${dayName} opens at`}
                      value={span.opensAt}
                      onChange={(event) =>
                        updateDay(
                          weekday,
                          daySpans.map((other, otherIndex) =>
                            otherIndex === index
                              ? { ...other, opensAt: event.target.value }
                              : other,
                          ),
                        )
                      }
                      required
                    />
                    <span className="text-sm text-muted-foreground">to</span>
                    <Input
                      type="time"
                      step={300}
                      aria-label={`${dayName} closes at`}
                      value={span.closesAt}
                      onChange={(event) =>
                        updateDay(
                          weekday,
                          daySpans.map((other, otherIndex) =>
                            otherIndex === index
                              ? { ...other, closesAt: event.target.value }
                              : other,
                          ),
                        )
                      }
                      required
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Remove ${dayName} ${span.opensAt} to ${span.closesAt}`}
                      onClick={() =>
                        updateDay(
                          weekday,
                          daySpans.filter(
                            (_, otherIndex) => otherIndex !== index,
                          ),
                        )
                      }
                    >
                      <X aria-hidden />
                    </Button>
                  </div>
                ))}
                <div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    aria-label={`Add hours on ${dayName}`}
                    onClick={() =>
                      updateDay(weekday, [
                        ...daySpans,
                        daySpans.length === 0
                          ? { opensAt: "09:00", closesAt: "17:00" }
                          : { opensAt: "18:00", closesAt: "21:00" },
                      ])
                    }
                  >
                    Add hours
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </fieldset>

      <p className="text-xs text-muted-foreground">
        Closing at 00:00 (12:00 AM) means open until midnight.
      </p>
      {state.error ? (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      ) : (
        state.saved && (
          <p role="status" className="text-sm text-muted-foreground">
            Saved.
          </p>
        )
      )}
      <div>
        <Button type="submit" disabled={pending}>
          {pending ? "Saving..." : "Save hours"}
        </Button>
      </div>
    </form>
  );
}
