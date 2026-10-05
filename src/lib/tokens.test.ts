import { describe, expect, it } from "vitest";
import { createToken, hashToken } from "@/lib/tokens";

describe("secret tokens", () => {
  it("hashes a token exactly as the database does", () => {
    // select encode(sha256(convert_to('admin-link', 'UTF8')), 'hex')
    expect(hashToken("admin-link")).toBe(
      "065c3db99a54b1be344223dce31f4b7a5433e8a027e86f15d904a08fa66bca74",
    );
  });

  it("makes a new URL-safe token every time, with its hash", () => {
    const first = createToken();
    const second = createToken();
    expect(first.token).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(first.token).not.toBe(second.token);
    expect(first.tokenHash).toBe(hashToken(first.token));
    expect(first.tokenHash).toMatch(/^[0-9a-f]{64}$/);
  });
});
