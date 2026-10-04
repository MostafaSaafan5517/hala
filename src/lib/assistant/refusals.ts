// What the assistant is told when the booking functions refuse (error codes HB001-HB008, see the
// create_booking_actions migration): what happened and what to do next. Written for the model,
// in English; it tells the customer in their own language.
const refusals: Record<string, string> = {
  HB001:
    "That time was just taken. Check availability again and offer the customer other times.",
  HB002:
    "That time isn't open for booking. Check availability and offer times from the list.",
  HB003:
    "That time is inside the business's minimum notice. Offer a later time.",
  HB004: "That's further ahead than the business takes bookings.",
  HB005:
    "That staff member doesn't offer this service, or the service can't be booked.",
  HB006:
    "This request conflicts with an earlier one. Ask the customer to confirm again.",
  HB007:
    "It's too late for the customer to change this booking themselves. Offer to put them in touch with the team.",
  HB008:
    "This booking can't be changed any more: it is cancelled or has already started.",
};

/** The refusal message for a booking function's error, or null when the error isn't a refusal. */
export function refusalFor(error: { code: string }): string | null {
  return refusals[error.code] ?? null;
}
