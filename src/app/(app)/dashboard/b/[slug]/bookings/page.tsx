import type { Metadata } from "next";
import Link from "next/link";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { ServiceName } from "@/components/service-name";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { requireMemberBusiness } from "@/lib/business";
import {
  addDays,
  formatDay,
  formatLocalTime,
  isIsoDate,
  todayIn,
} from "@/lib/dates";
import { formatPhone } from "@/lib/phone";
import { cn } from "@/lib/utils";

export const metadata: Metadata = { title: "Bookings" };

export default async function BookingsPage({
  params,
  searchParams,
}: PageProps<"/dashboard/b/[slug]/bookings">) {
  const { slug } = await params;
  const { day: dayParam } = await searchParams;
  const { supabase, business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/bookings`,
  );

  const today = todayIn(business.timezone);
  const day =
    typeof dayParam === "string" && isIsoDate(dayParam) ? dayParam : today;

  // The day's bookings, cancelled ones included, through RLS as the user.
  const { data: bookings, error } = await supabase
    .rpc("day_bookings", { target_business_id: business.id, day })
    .select(
      "id, reference, starts_at, ends_at, status, customers (name, phone), services (name_en, name_ar), staff (name)",
    );
  if (error) throw new Error(`Could not load bookings: ${error.message}`);

  const base = `/dashboard/b/${business.slug}/bookings`;
  const dayLink = buttonVariants({ variant: "outline", size: "sm" });

  return (
    <>
      <BusinessHeader business={business} role={role} current="bookings" />

      <section className="grid gap-3" aria-labelledby="bookings-heading">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h2 id="bookings-heading" className="text-lg font-semibold">
            {formatDay(day)}
            {day === today && (
              <span className="font-normal text-muted-foreground">
                {" "}
                (today)
              </span>
            )}
          </h2>
          <Link
            href={`${base}/new?day=${day}`}
            className={buttonVariants({ variant: "outline" })}
          >
            New booking
          </Link>
        </div>
        <nav aria-label="Days" className="flex flex-wrap items-center gap-2">
          <Link href={`${base}?day=${addDays(day, -1)}`} className={dayLink}>
            Previous day
          </Link>
          {day !== today && (
            <Link href={base} className={dayLink}>
              Today
            </Link>
          )}
          <Link href={`${base}?day=${addDays(day, 1)}`} className={dayLink}>
            Next day
          </Link>
          <form className="flex items-center gap-2">
            <Label htmlFor="day" className="sr-only">
              Go to date
            </Label>
            <Input
              id="day"
              name="day"
              type="date"
              defaultValue={day}
              className="h-7 w-auto"
              required
            />
            <Button type="submit" variant="outline" size="sm">
              Go
            </Button>
          </form>
        </nav>
        <p className="text-sm text-muted-foreground">
          Times are in {business.timezone.replaceAll("_", " ")} time.
        </p>

        {bookings.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No bookings on this day.
          </p>
        ) : (
          <ul className="grid gap-2">
            {bookings.map((booking) => {
              const cancelled = booking.status === "cancelled";
              return (
                <li key={booking.id}>
                  <Link
                    href={`${base}/${booking.id}`}
                    className="grid gap-1 rounded-lg border p-3 text-sm hover:bg-muted/50 sm:grid-cols-[7rem_1fr_auto] sm:items-center sm:gap-4"
                  >
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        cancelled && "text-muted-foreground line-through",
                      )}
                    >
                      {formatLocalTime(booking.starts_at, business.timezone)}–
                      {formatLocalTime(booking.ends_at, business.timezone)}
                    </span>
                    <span className="grid gap-0.5">
                      <span>
                        <span dir="auto" className="font-medium">
                          {booking.customers.name}
                        </span>{" "}
                        · <ServiceName service={booking.services} /> with{" "}
                        <span dir="auto">{booking.staff.name}</span>
                      </span>
                      <span className="text-muted-foreground" dir="ltr">
                        {formatPhone(booking.customers.phone)}
                      </span>
                    </span>
                    <span className="text-muted-foreground">
                      {cancelled ? "Cancelled" : booking.reference}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
