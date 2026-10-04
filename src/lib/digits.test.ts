import { describe, expect, it } from "vitest";
import { westernDigits } from "@/lib/digits";

describe("westernDigits", () => {
  it("turns Arabic-Indic and Eastern Arabic digits into 0-9, leaving the rest", () => {
    expect(westernDigits("٠١٢٣٤٥٦٧٨٩")).toBe("0123456789");
    expect(westernDigits("۰۱۲۳۴۵۶۷۸۹")).toBe("0123456789");
    expect(westernDigits("+٢٠ 10")).toBe("+20 10");
  });
});
