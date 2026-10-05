import { describe, expect, it } from "vitest";
import { frameAncestors } from "@/lib/widget/frame-policy";

describe("frameAncestors", () => {
  it("allows Hala's own pages and the business's sites", () => {
    expect(
      frameAncestors(["https://nour-salon.com", "http://localhost:3000"]),
    ).toBe(
      "frame-ancestors 'self' https://nour-salon.com http://localhost:3000",
    );
  });

  it("allows only Hala's own pages when the business allowed none", () => {
    expect(frameAncestors([])).toBe("frame-ancestors 'self'");
  });
});
