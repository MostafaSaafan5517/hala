import { describe, expect, it } from "vitest";
import { timeZoneOptions } from "@/lib/time-zones";

describe("timeZoneOptions", () => {
  it("offers UTC first, then the named zones", () => {
    const zones = timeZoneOptions();
    expect(zones[0]).toBe("UTC");
    expect(zones).toEqual(
      expect.arrayContaining(["Africa/Cairo", "Asia/Riyadh", "Asia/Dubai"]),
    );
  });

  it("offers each zone once, and no fixed offsets", () => {
    const zones = timeZoneOptions();
    expect(new Set(zones).size).toBe(zones.length);
    expect(zones.some((zone) => /^[+-]\d/.test(zone))).toBe(false);
  });
});
