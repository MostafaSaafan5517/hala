/**
 * The time zones a business can choose: every IANA zone the runtime knows, plus UTC, which Intl
 * doesn't list. The database accepts all of them (businesses.timezone is checked against
 * Postgres's named zones, which include the older names Intl still returns, like Asia/Calcutta).
 */
export function timeZoneOptions(): string[] {
  return ["UTC", ...Intl.supportedValuesOf("timeZone")];
}
