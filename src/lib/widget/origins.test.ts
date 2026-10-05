import { describe, expect, it } from "vitest";
import { parseOrigins } from "@/lib/widget/origins";

describe("parseOrigins", () => {
  it("turns the sites typed, one per line, into origins as browsers send them", () => {
    expect(
      parseOrigins(
        "https://Nour-Salon.com/\n\n  http://localhost:3000  \nhttps://nour-salon.com",
      ),
    ).toEqual(["https://nour-salon.com", "http://localhost:3000"]);
    expect(parseOrigins("")).toEqual([]);
  });

  it("refuses anything that isn't a whole site", () => {
    expect(parseOrigins("nour-salon.com")).toMatchObject({
      error: expect.stringContaining("isn't a web address"),
    });
    expect(parseOrigins("https://nour-salon.com/booking")).toMatchObject({
      error: expect.stringContaining("without a page or path"),
    });
    expect(parseOrigins("ftp://nour-salon.com")).toMatchObject({
      error: expect.any(String),
    });
  });

  it("allows at most ten sites", () => {
    const eleven = Array.from({ length: 11 }, (_, n) => `https://s${n}.com`);
    expect(parseOrigins(eleven.join("\n"))).toEqual({
      error: "Allow at most 10 sites.",
    });
  });
});
