import type { CustomerLanguage } from "@/lib/assistant/language";
import { formatAmount } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

// What the customer sees on an approval card before a booking, move or cancellation runs, in
// their language. Built on the server from the database, never from the model's words.

/** A service's name in the customer's language when it has one, otherwise its other name. */
export function serviceNameIn(
  service: { name_en: string | null; name_ar: string | null },
  language: CustomerLanguage,
) {
  return (
    (language === "ar"
      ? (service.name_ar ?? service.name_en)
      : (service.name_en ?? service.name_ar)) ?? ""
  );
}

// Arabic dates and times keep Western digits ("u-nu-latn"), as phone numbers and prices do.
const locales = { en: "en-GB", ar: "ar-u-nu-latn" } as const;

function moment(iso: string, timeZone: string, language: CustomerLanguage) {
  return new Intl.DateTimeFormat(locales[language], {
    timeZone,
    weekday: language === "ar" ? "long" : "short",
    day: "numeric",
    month: language === "ar" ? "long" : "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

function time(iso: string, timeZone: string) {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(iso));
}

export function bookingSummary(
  booking: {
    serviceName: string;
    staffName: string | null;
    startsAt: string;
    endsAt: string;
    price: number;
    currency: string;
    customerName: string;
    customerPhone: string;
  },
  timeZone: string,
  language: CustomerLanguage,
) {
  const when = moment(booking.startsAt, timeZone, language);
  const until = time(booking.endsAt, timeZone);
  const price = formatAmount(
    booking.price,
    booking.currency,
    locales[language],
  );
  const phone = formatPhone(booking.customerPhone);
  if (language === "ar") {
    const withStaff = booking.staffName ? ` مع ${booking.staffName}` : "";
    return `${booking.serviceName}${withStaff}، ${when} حتى ${until}، ${price}، باسم ${booking.customerName} (${phone}).`;
  }
  const withStaff = booking.staffName ? ` with ${booking.staffName}` : "";
  return `${booking.serviceName}${withStaff} on ${when} to ${until}, ${price}, for ${booking.customerName} (${phone}).`;
}

export function rescheduleSummary(
  change: {
    reference: string;
    serviceName: string;
    from: string;
    to: string;
    staffName: string | null;
  },
  timeZone: string,
  language: CustomerLanguage,
) {
  const from = moment(change.from, timeZone, language);
  const to = moment(change.to, timeZone, language);
  if (language === "ar") {
    const withStaff = change.staffName ? ` مع ${change.staffName}` : "";
    return `نقل الحجز ${change.reference} (${change.serviceName}، ${from}) إلى ${to}${withStaff}.`;
  }
  const withStaff = change.staffName ? ` with ${change.staffName}` : "";
  return `Move booking ${change.reference} (${change.serviceName}, ${from}) to ${to}${withStaff}.`;
}

export function cancellationSummary(
  booking: { reference: string; serviceName: string; startsAt: string },
  timeZone: string,
  language: CustomerLanguage,
) {
  const when = moment(booking.startsAt, timeZone, language);
  return language === "ar"
    ? `إلغاء الحجز ${booking.reference} (${booking.serviceName}، ${when}).`
    : `Cancel booking ${booking.reference} (${booking.serviceName}, ${when}).`;
}
