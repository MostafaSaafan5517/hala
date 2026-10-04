import { describe, expect, it } from "vitest";
import {
  describeCancellation,
  describeNotice,
  describeSlotInterval,
} from "@/lib/booking-rules";

describe("booking rule wording", () => {
  it("describes notice, cancellation and start times the way people say them", () => {
    expect(describeNotice(0)).toBe("No minimum: up to the start time");
    expect(describeNotice(120)).toBe("At least 2 h ahead");
    expect(describeCancellation(0)).toBe("Any time before it starts");
    expect(describeCancellation(24)).toBe("Up to 24 h before it starts");
    expect(describeSlotInterval(15)).toBe("Every 15 min");
    expect(describeSlotInterval(60)).toBe("Every 1 h");
  });
});
