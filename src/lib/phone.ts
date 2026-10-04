import { parsePhoneNumberFromString } from "libphonenumber-js/max";
import { westernDigits } from "@/lib/digits";

/**
 * A phone number typed by a person ("+20 10 1234 5678", "0020 101 234 5678", Arabic digits),
 * in E.164 ("+201012345678"), or null when it isn't a valid number. The country code is
 * required: a business can have customers from several countries, so we never guess one.
 */
export function normalizePhone(text: string): string | null {
  const typed = westernDigits(text).trim().replace(/^00/, "+");
  if (!typed.startsWith("+")) return null;
  const phone = parsePhoneNumberFromString(typed);
  return phone?.isValid() ? phone.number : null;
}

/** An E.164 number written for people, grouped the way its country writes it. */
export function formatPhone(e164: string) {
  return parsePhoneNumberFromString(e164)?.formatInternational() ?? e164;
}
