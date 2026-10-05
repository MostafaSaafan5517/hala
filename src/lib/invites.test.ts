import { describe, expect, it } from "vitest";
import { isPending } from "@/lib/invites";

describe("isPending", () => {
  const now = Date.parse("2026-10-03T12:00:00Z");

  it("is true for an unused invite that hasn't expired", () => {
    expect(
      isPending({ accepted_at: null, expires_at: "2026-10-03T12:00:01Z" }, now),
    ).toBe(true);
  });

  it("is false once it's used or expired", () => {
    expect(
      isPending(
        {
          accepted_at: "2026-10-02T09:00:00Z",
          expires_at: "2026-10-09T12:00:00Z",
        },
        now,
      ),
    ).toBe(false);
    expect(
      isPending({ accepted_at: null, expires_at: "2026-10-03T12:00:00Z" }, now),
    ).toBe(false);
  });
});
