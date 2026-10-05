// How the Usage tab writes amounts. Costs are US dollars from the usage log, often fractions of
// a cent, so amounts under a dollar keep up to four decimals instead of rounding to cents.

/** A cost in US dollars: "$1.25", "$0.014", "$0.0035", or "< $0.0001" for a sliver above nothing. */
export function formatUsd(amount: number) {
  if (amount > 0 && amount < 0.0001) return "< $0.0001";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 2,
    maximumFractionDigits: amount < 1 ? 4 : 2,
  }).format(amount);
}

/** A count with thousands separators: "12,480". */
export function formatCount(count: number) {
  return new Intl.NumberFormat("en-US").format(count);
}

/** A duration in milliseconds as people read it: "850 ms", "4.2 s", or "–" when there's none. */
export function formatDuration(ms: number | null) {
  if (ms === null) return "–";
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

/** A plain date (YYYY-MM-DD) as a table row's label: "Mon 5 Oct". */
export function formatRowDay(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    weekday: "short",
    day: "numeric",
    month: "short",
  })
    .format(new Date(`${date}T00:00:00Z`))
    .replace(",", "");
}

/** A plain date (YYYY-MM-DD) as a short axis label: "5 Oct". */
export function formatShortDay(date: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "UTC",
    day: "numeric",
    month: "short",
  }).format(new Date(`${date}T00:00:00Z`));
}

/** The top of a chart's scale: the smallest 1, 2 or 5 times a power of ten that holds `max`. */
export function niceCeiling(max: number) {
  if (max <= 0) return 0;
  const power = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 5, 10].find((multiple) => multiple * power >= max) ?? 10;
  return step * power;
}
