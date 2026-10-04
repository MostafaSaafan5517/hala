import { describe, expect, it } from "vitest";
import { newPasswordSchema } from "@/lib/password";

describe("newPasswordSchema", () => {
  it("accepts 8 or more characters with letters and numbers", () => {
    expect(newPasswordSchema.safeParse("correct-horse-1").success).toBe(true);
    expect(newPasswordSchema.safeParse("abcdefg1").success).toBe(true);
  });

  it("refuses short passwords and ones without both letters and numbers", () => {
    for (const password of ["abc1", "abcdefgh", "12345678", ""]) {
      expect(newPasswordSchema.safeParse(password).success).toBe(false);
    }
  });
});
