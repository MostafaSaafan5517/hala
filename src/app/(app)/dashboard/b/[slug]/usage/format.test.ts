import { describe, expect, it } from "vitest";
import {
  formatCount,
  formatDuration,
  formatRowDay,
  formatShortDay,
  formatUsd,
  niceCeiling,
} from "@/app/(app)/dashboard/b/[slug]/usage/format";

describe("formatUsd", () => {
  it("keeps cents from a dollar up, and up to four decimals below it", () => {
    expect(formatUsd(1.25)).toBe("$1.25");
    expect(formatUsd(1.256)).toBe("$1.26");
    expect(formatUsd(0)).toBe("$0.00");
    expect(formatUsd(0.26)).toBe("$0.26");
    expect(formatUsd(0.014)).toBe("$0.014");
    expect(formatUsd(0.003)).toBe("$0.003");
    expect(formatUsd(0.0035)).toBe("$0.0035");
    expect(formatUsd(0.0000004)).toBe("< $0.0001");
    expect(formatUsd(1234.5)).toBe("$1,234.50");
  });
});

describe("formatCount and formatDuration", () => {
  it("write counts with separators and durations in ms or seconds", () => {
    expect(formatCount(12480)).toBe("12,480");
    expect(formatDuration(850)).toBe("850 ms");
    expect(formatDuration(4210)).toBe("4.2 s");
    expect(formatDuration(null)).toBe("None");
  });
});

describe("formatShortDay", () => {
  it("writes a plain date as day and month, whatever the server's time zone", () => {
    expect(formatShortDay("2026-10-05")).toBe("5 Oct");
    expect(formatRowDay("2026-10-05")).toBe("Mon, 5 Oct");
  });
});

describe("niceCeiling", () => {
  it("rounds a maximum up to 1, 2 or 5 times a power of ten", () => {
    expect(niceCeiling(0.0037)).toBeCloseTo(0.005);
    expect(niceCeiling(0.012)).toBeCloseTo(0.02);
    expect(niceCeiling(3)).toBe(5);
    expect(niceCeiling(1)).toBe(1);
    expect(niceCeiling(7.5)).toBe(10);
    expect(niceCeiling(0)).toBe(0);
  });
});
