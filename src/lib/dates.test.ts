import { describe, expect, it } from "vitest";
import { formatDay, formatLocalDateTime, todayIn } from "@/lib/dates";

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
