// Moments are stored in UTC and shown in the business's own time zone; whole days (closures)
// are stored as plain dates.

/** A moment as the business reads it: "Mon, 5 Oct 2026, 10:00", in its time zone. */
export function formatLocalDateTime(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

/** A plain date (YYYY-MM-DD) as people read it: "Fri, 20 Mar 2026". */
export function formatDay(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** The date it is now in a time zone, as YYYY-MM-DD. */
export function todayIn(timeZone: string, now = new Date()) {
  // The en-CA locale writes dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** The current moment as an ISO string, for "still upcoming" filters in queries. */
export function nowIso() {
  return new Date().toISOString();
}
