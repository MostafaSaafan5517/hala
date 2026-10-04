import type { SupabaseClient } from "@supabase/supabase-js";
import type { TimeOption } from "@/app/(app)/dashboard/b/[slug]/bookings/booking-forms";
import { formatLocalTime } from "@/lib/dates";
import type { Database } from "@/lib/supabase/database.types";

/**
 * The free start times for a service on one of the business's local days, each listed once
 * (with "anyone available", several staff can be free at the same time). Comes from the same
 * database function the booking check uses, so every time listed can really be booked.
 */
export async function freeTimes(
  supabase: SupabaseClient<Database>,
  options: {
    serviceId: string;
    day: string;
    staffId: string | null;
    timeZone: string;
    ignoredBookingId?: string;
  },
): Promise<TimeOption[]> {
  const { data, error } = await supabase.rpc("available_slots", {
    target_service_id: options.serviceId,
    from_date: options.day,
    to_date: options.day,
    target_staff_id: options.staffId ?? undefined,
    ignored_booking_id: options.ignoredBookingId,
  });
  if (error) throw new Error(`Could not load free times: ${error.message}`);
  // Already in time order.
  return [...new Set(data.map((slot) => slot.starts_at))].map((startsAt) => ({
    value: startsAt,
    label: formatLocalTime(startsAt, options.timeZone),
  }));
}
