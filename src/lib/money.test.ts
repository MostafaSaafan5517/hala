import { describe, expect, it } from "vitest";
import {
  amountToInput,
  formatAmount,
  MAX_PRICE,
  minorUnitDigits,
  parseAmount,
} from "@/lib/money";

describe("minorUnitDigits", () => {
  it("knows how many decimals each currency has", () => {
    expect(minorUnitDigits("EGP")).toBe(2);
    expect(minorUnitDigits("KWD")).toBe(3);
    expect(minorUnitDigits("JPY")).toBe(0);
  });
});

describe("parseAmount", () => {
  it("turns typed prices into the smallest unit, exactly", () => {
    expect(parseAmount("250", "EGP")).toBe(25000);
    expect(parseAmount("249.5", "EGP")).toBe(24950);
    expect(parseAmount("0.1", "EGP")).toBe(10);
    expect(parseAmount("1,250.75", "SAR")).toBe(125075);
    expect(parseAmount(" 12.345 ", "KWD")).toBe(12345);
    expect(parseAmount("1500", "JPY")).toBe(1500);
  });

  it("accepts Arabic digits and separators", () => {
    expect(parseAmount("٢٥٠", "EGP")).toBe(25000);
    expect(parseAmount("٢٤٩٫٥", "EGP")).toBe(24950);
    expect(parseAmount("١٬٢٥٠", "SAR")).toBe(125000);
    expect(parseAmount("۳۰۰", "AED")).toBe(30000);
  });

  it("refuses what isn't a valid amount for the currency", () => {
    expect(parseAmount("12.345", "EGP")).toBeNull();
    expect(parseAmount("1.5", "JPY")).toBeNull();
    expect(parseAmount("-5", "EGP")).toBeNull();
    expect(parseAmount("abc", "EGP")).toBeNull();
    expect(parseAmount("", "EGP")).toBeNull();
    expect(parseAmount("1e3", "EGP")).toBeNull();
    expect(parseAmount(String(MAX_PRICE), "EGP")).toBeNull();
  });
});

describe("amountToInput", () => {
  it("puts a stored amount back the way people type it", () => {
    expect(amountToInput(25000, "EGP")).toBe("250.00");
    expect(amountToInput(5, "EGP")).toBe("0.05");
    expect(amountToInput(12345, "KWD")).toBe("12.345");
    expect(amountToInput(1500, "JPY")).toBe("1500");
  });

  it("round-trips through parseAmount", () => {
    for (const [amount, currency] of [
      [25000, "EGP"],
      [7, "BHD"],
      [0, "USD"],
    ] as const) {
      expect(parseAmount(amountToInput(amount, currency), currency)).toBe(
        amount,
      );
    }
  });
});

describe("formatAmount", () => {
  // Intl separates the code from the number with a non-breaking space.
  const plain = (text: string) => text.replace(/\s/g, " ");

  it("shows the amount in the currency's own decimals", () => {
    expect(plain(formatAmount(25000, "EGP"))).toBe("EGP 250.00");
    expect(plain(formatAmount(12345, "KWD"))).toBe("KWD 12.345");
  });

  it("formats for Arabic readers too", () => {
    expect(formatAmount(25000, "EGP", "ar-EG")).toMatch(/٢٥٠/);
  });
});
