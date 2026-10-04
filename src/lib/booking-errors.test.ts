import { describe, expect, it } from "vitest";
import { bookingErrorMessage } from "@/lib/booking-errors";

describe("bookingErrorMessage", () => {
  it("explains each refusal the booking functions can give", () => {
    for (let code = 1; code <= 8; code += 1) {
      expect(bookingErrorMessage(`HB00${code}`)).toEqual(expect.any(String));
    }
    expect(bookingErrorMessage("HB001")).toBe(
      "That time has just been booked. Choose another time.",
    );
  });

  it("leaves other errors to the caller", () => {
    expect(bookingErrorMessage("23505")).toBeNull();
    expect(bookingErrorMessage(undefined)).toBeNull();
  });
});
