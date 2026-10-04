// Weekly opening hours: spans of local time on a weekday (0 is Sunday). A span closing at 24:00
// is open until midnight; spans never run past midnight.

export type Span = { weekday: number; opensAt: string; closesAt: string };

export const WEEKDAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
] as const;

const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

/** Minutes since midnight for "HH:MM", or null when it isn't a time. "24:00" is 1440. */
export function minutesOf(time: string): number | null {
  if (time === "24:00") return 24 * 60;
  const match = TIME.exec(time);
  if (!match) return null;
  return Number(match[1]) * 60 + Number(match[2]);
}

/**
 * The closing time as stored: a span closing at 00:00 closes at midnight at the end of its day,
 * which the database writes as 24:00 (time inputs can't show 24:00).
 */
export function closingTime(time: string): string {
  return time === "00:00" ? "24:00" : time;
}

/** A schedule's first problem, in words, or null when every span is valid and none overlap. */
export function scheduleProblem(spans: Span[]): string | null {
  const byDay = new Map<number, { opens: number; closes: number }[]>();
  for (const span of spans) {
    const day = WEEKDAYS[span.weekday];
    if (!Number.isInteger(span.weekday) || !day) return "Choose a weekday.";
    const opens = minutesOf(span.opensAt);
    const closes = minutesOf(span.closesAt);
    if (opens === null || closes === null || opens === 24 * 60) {
      return `Enter times like 09:00 on ${day}.`;
    }
    if (closes <= opens) {
      return `On ${day}, closing time must be after opening time.`;
    }
    byDay.set(span.weekday, [
      ...(byDay.get(span.weekday) ?? []),
      { opens, closes },
    ]);
  }
  for (const [weekday, daySpans] of byDay) {
    const sorted = daySpans.toSorted((a, b) => a.opens - b.opens);
    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (previous && current && current.opens < previous.closes) {
        return `On ${WEEKDAYS[weekday]}, the hours overlap.`;
      }
    }
  }
  return null;
}
