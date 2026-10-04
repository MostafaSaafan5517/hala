import { describe, expect, it } from "vitest";
import { formatPhone, normalizePhone } from "@/lib/phone";

describe("normalizePhone", () => {
  it("stores numbers typed in any common way in one format", () => {
    expect(normalizePhone("+20 10 1234 5678")).toBe("+201012345678");
    expect(normalizePhone("+20 (10) 1234-5678")).toBe("+201012345678");
    expect(normalizePhone("0020 101 234 5678")).toBe("+201012345678");
    expect(normalizePhone(" +966 50 123 4567 ")).toBe("+966501234567");
  });

  it("accepts Arabic digits", () => {
    expect(normalizePhone("+٢٠ ١٠ ١٢٣٤ ٥٦٧٨")).toBe("+201012345678");
    expect(normalizePhone("+۹۶۶۵۰۱۲۳۴۵۶۷")).toBe("+966501234567");
  });

  it("needs the country code, and a real number", () => {
    expect(normalizePhone("010 1234 5678")).toBeNull();
    expect(normalizePhone("+20 123")).toBeNull();
    expect(normalizePhone("call me")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
});

describe("formatPhone", () => {
  it("groups the digits the way the number's country does", () => {
    expect(formatPhone("+201012345678")).toBe("+20 10 12345678");
    expect(formatPhone("+966501234567")).toBe("+966 50 123 4567");
  });
});
