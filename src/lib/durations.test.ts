import { describe, expect, it } from "vitest";
import { formatDuration } from "@/lib/durations";

describe("formatDuration", () => {
  it("reads like people say it", () => {
    expect(formatDuration(5)).toBe("5 min");
    expect(formatDuration(45)).toBe("45 min");
    expect(formatDuration(60)).toBe("1 h");
    expect(formatDuration(90)).toBe("1 h 30 min");
    expect(formatDuration(720)).toBe("12 h");
  });
});
