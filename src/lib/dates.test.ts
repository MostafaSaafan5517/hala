import { describe, expect, it } from "vitest";
import {
  addDays,
  formatDay,
  formatLocalDateTime,
  formatLocalTime,
  isIsoDate,
  todayIn,
} from "@/lib/dates";

describe("formatLocalDateTime", () => {
  it("shows a moment in the business's time zone, daylight saving included", () => {
    // Cairo is UTC+3 in October and UTC+2 in January.
    expect(formatLocalDateTime("2026-10-05T07:00:00Z", "Africa/Cairo")).toBe(
      "Mon, 5 Oct 2026, 10:00",
    );
    expect(formatLocalDateTime("2026-01-10T08:00:00Z", "Africa/Cairo")).toBe(
      "Sat, 10 Jan 2026, 10:00",
    );
    expect(formatLocalDateTime("2026-10-05T07:00:00Z", "Asia/Riyadh")).toBe(
      "Mon, 5 Oct 2026, 10:00",
    );
  });
});

describe("formatDay", () => {
  it("shows a plain date without shifting it across time zones", () => {
    expect(formatDay("2026-03-20")).toBe("Fri, 20 Mar 2026");
  });
});

describe("todayIn", () => {
  it("gives the local date, which can differ from UTC's", () => {
    const lateEvening = new Date("2026-10-04T22:30:00Z");
    expect(todayIn("UTC", lateEvening)).toBe("2026-10-04");
    expect(todayIn("Africa/Cairo", lateEvening)).toBe("2026-10-05");
  });
});

describe("formatLocalTime", () => {
  it("shows the time of day in the business's time zone", () => {
    expect(formatLocalTime("2026-10-05T07:00:00Z", "Africa/Cairo")).toBe(
      "10:00",
    );
    expect(formatLocalTime("2026-11-05T07:00:00Z", "Africa/Cairo")).toBe(
      "09:00",
    );
    expect(formatLocalTime("2026-10-05T21:30:00Z", "Africa/Cairo")).toBe(
      "00:30",
    );
  });
});

describe("isIsoDate", () => {
  it("accepts real dates written YYYY-MM-DD", () => {
    expect(isIsoDate("2026-10-05")).toBe(true);
    expect(isIsoDate("2028-02-29")).toBe(true);
  });

  it("refuses anything else", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-13-01")).toBe(false);
    expect(isIsoDate("5 Oct 2026")).toBe(false);
    expect(isIsoDate("")).toBe(false);
  });
});

describe("addDays", () => {
  it("moves across months and years", () => {
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2026-03-28", 2)).toBe("2026-03-30");
  });
});
