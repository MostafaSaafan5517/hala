// Amounts are stored as integers in the currency's smallest unit (piasters, halalas, fils), and
// currencies differ in how many decimals that is. Intl knows each currency's ISO 4217 decimals.

/** The currencies offered when setting a price. The database accepts any ISO 4217 code. */
export const PRICE_CURRENCIES = [
  "EGP",
  "SAR",
  "AED",
  "KWD",
  "QAR",
  "BHD",
  "OMR",
  "JOD",
  "USD",
  "EUR",
  "GBP",
] as const;

/** The largest price we accept, in the smallest unit: it must fit a Postgres integer. */
export const MAX_PRICE = 2_000_000_000;

/** How many decimals a currency's amounts have: 2 for EGP, 3 for KWD, 0 for JPY. */
export function minorUnitDigits(currency: string): number {
  return (
    new Intl.NumberFormat("en", {
      style: "currency",
      currency,
    }).resolvedOptions().maximumFractionDigits ?? 2
  );
}

// Arabic-Indic (٠-٩) and Eastern Arabic (۰-۹) digits, and the Arabic decimal and thousands
// separators, so prices typed on an Arabic keyboard work too.
function westernDigits(text: string) {
  return text
    .replace(/[٠-٩]/g, (digit) => String(digit.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (digit) => String(digit.charCodeAt(0) - 0x06f0))
    .replaceAll("٫", ".")
    .replaceAll("٬", ",");
}

/**
 * A price typed by a person ("250", "249.5", "1,250.75", "٢٥٠") in the currency's smallest unit,
 * computed exactly with integers, never floats. Null when it isn't a valid amount for the
 * currency (too many decimals, not a number, negative, or too large).
 */
export function parseAmount(text: string, currency: string): number | null {
  const digits = minorUnitDigits(currency);
  const cleaned = westernDigits(text.trim()).replaceAll(",", "");
  const match = /^(\d+)(?:\.(\d+))?$/.exec(cleaned);
  if (!match) return null;
  const [, whole = "", fraction = ""] = match;
  if (fraction.length > digits) return null;
  const amount =
    Number(whole) * 10 ** digits + Number(fraction.padEnd(digits, "0") || 0);
  return Number.isSafeInteger(amount) && amount <= MAX_PRICE ? amount : null;
}

/** An amount in the smallest unit, ready to put back in a form field ("250.00"). */
export function amountToInput(amount: number, currency: string): string {
  const digits = minorUnitDigits(currency);
  if (digits === 0) return String(amount);
  const text = String(amount).padStart(digits + 1, "0");
  return `${text.slice(0, -digits)}.${text.slice(-digits)}`;
}

/** An amount in the smallest unit, formatted for people ("EGP 250.00"). */
export function formatAmount(amount: number, currency: string, locale = "en") {
  return new Intl.NumberFormat(locale, { style: "currency", currency }).format(
    amount / 10 ** minorUnitDigits(currency),
  );
}
