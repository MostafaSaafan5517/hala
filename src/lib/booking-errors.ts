// The booking functions refuse with their own error codes (see the create_booking_actions
// migration). This is how the dashboard explains each one to staff.
const messages: Record<string, string> = {
  HB001: "That time has just been booked. Choose another time.",
  HB002: "That time isn't available. Choose one of the times shown.",
  HB003: "That's too soon to book: it's inside the business's notice period.",
  HB004: "That's further ahead than the business takes bookings.",
  HB005:
    "That staff member doesn't offer this service, or the service is archived.",
  HB006:
    "This form was already used for a different request. Reload the page and try again.",
  HB007: "It's too late to change this booking.",
  HB008:
    "This booking can't be changed any more: it's cancelled or has already started.",
};

/** The message for a booking refusal, or null when the error isn't one. */
export function bookingErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return messages[code] ?? null;
}
