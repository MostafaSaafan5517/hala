import { formatDuration } from "@/lib/durations";

// The choices the booking rules form offers. The database's checks are the real limits; these
// are the sensible values within them.

/** Minimum notice before an appointment, in minutes. */
export const NOTICE_MINUTES = [
  0, 15, 30, 60, 120, 240, 720, 1440, 2880,
] as const;

/** How often appointments can start, in minutes (the database allows exactly these). */
export const SLOT_INTERVALS = [5, 10, 15, 20, 30, 60] as const;

/** How late a customer can still cancel or move a booking, in hours. */
export const CANCELLATION_HOURS = [0, 1, 2, 4, 12, 24, 48, 72, 168] as const;

export function describeNotice(minutes: number) {
  return minutes === 0
    ? "No minimum: up to the start time"
    : `At least ${formatDuration(minutes)} ahead`;
}

export function describeCancellation(hours: number) {
  return hours === 0
    ? "Any time before it starts"
    : `Up to ${formatDuration(hours * 60)} before it starts`;
}

export function describeSlotInterval(minutes: number) {
  return `Every ${formatDuration(minutes)}`;
}
