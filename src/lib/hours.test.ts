import { describe, expect, it } from "vitest";
import { closingTime, minutesOf, scheduleProblem } from "@/lib/hours";

describe("minutesOf", () => {
  it("reads HH:MM, and 24:00 as the end of the day", () => {
    expect(minutesOf("00:00")).toBe(0);
    expect(minutesOf("09:30")).toBe(570);
    expect(minutesOf("24:00")).toBe(1440);
  });

  it("refuses anything that isn't a time", () => {
    for (const text of ["9:30", "24:30", "12:60", "noon", ""]) {
      expect(minutesOf(text)).toBeNull();
    }
  });
});

describe("closingTime", () => {
  it("treats a 00:00 closing as midnight at the end of the day", () => {
    expect(closingTime("00:00")).toBe("24:00");
    expect(closingTime("17:00")).toBe("17:00");
  });
});

describe("scheduleProblem", () => {
  it("accepts split shifts, touching spans and closing at midnight", () => {
    expect(
      scheduleProblem([
        { weekday: 0, opensAt: "10:00", closesAt: "14:00" },
        { weekday: 0, opensAt: "14:00", closesAt: "18:00" },
        { weekday: 0, opensAt: "19:00", closesAt: "24:00" },
        { weekday: 1, opensAt: "10:00", closesAt: "14:00" },
      ]),
    ).toBeNull();
  });

  it("explains overlaps, backwards spans and bad times, naming the day", () => {
    expect(
      scheduleProblem([
        { weekday: 2, opensAt: "12:00", closesAt: "18:00" },
        { weekday: 2, opensAt: "09:00", closesAt: "13:00" },
      ]),
    ).toBe("On Tuesday, the hours overlap.");
    expect(
      scheduleProblem([{ weekday: 3, opensAt: "18:00", closesAt: "09:00" }]),
    ).toBe("On Wednesday, closing time must be after opening time.");
    expect(
      scheduleProblem([{ weekday: 4, opensAt: "9am", closesAt: "17:00" }]),
    ).toBe("Enter times like 09:00 on Thursday.");
    expect(
      scheduleProblem([{ weekday: 4, opensAt: "24:00", closesAt: "24:00" }]),
    ).toBe("Enter times like 09:00 on Thursday.");
    expect(
      scheduleProblem([{ weekday: 7, opensAt: "09:00", closesAt: "17:00" }]),
    ).toBe("Choose a weekday.");
  });
});
