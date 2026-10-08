import {
  CalendarBlank,
  CaretLeft,
  CaretRight,
  Plus,
  XCircle,
} from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { Badge } from "@/components/badge";
import { EmptyState } from "@/components/empty-state";
import { SectionHeader } from "@/components/section-header";
import { ServiceName } from "@/components/service-name";
import { surfaceLinkRow, surfaceList } from "@/components/surface";
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
  const zone = business.timezone.replaceAll("_", " ");

  return (
    <>
      <BusinessHeader business={business} role={role} current="bookings" />

      <section className="grid gap-4" aria-labelledby="bookings-heading">
        <SectionHeader
          id="bookings-heading"
          title={
            <>
              {formatDay(day)}
              {day === today && (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  (today)
                </span>
              )}
            </>
          }
          description={`Times are in ${zone} time.`}
          action={
            <Link href={`${base}/new?day=${day}`} className={buttonVariants()}>
              <Plus aria-hidden="true" />
              New booking
            </Link>
          }
        />
        <nav aria-label="Days" className="flex flex-wrap items-center gap-2">
          <Link href={`${base}?day=${addDays(day, -1)}`} className={dayLink}>
            <CaretLeft aria-hidden="true" className="rtl:-scale-x-100" />
            Previous day
          </Link>
          {day !== today && (
            <Link href={base} className={dayLink}>
              Today
            </Link>
          )}
          <Link href={`${base}?day=${addDays(day, 1)}`} className={dayLink}>
            Next day
            <CaretRight aria-hidden="true" className="rtl:-scale-x-100" />
          </Link>
          <form className="flex items-center gap-2 sm:ms-auto">
            <Label htmlFor="day" className="sr-only">
              Go to date
            </Label>
            <Input
              id="day"
              name="day"
              type="date"
              defaultValue={day}
              className="h-8 w-auto"
              required
            />
            <Button type="submit" variant="outline" size="sm">
              Go
            </Button>
          </form>
        </nav>

        {bookings.length === 0 ? (
          <EmptyState
            icon={<CalendarBlank aria-hidden="true" />}
            title="No bookings on this day."
          >
            Bookings the assistant takes, and the ones you add, appear here.
          </EmptyState>
        ) : (
          <ul className={surfaceList}>
            {bookings.map((booking) => {
              const cancelled = booking.status === "cancelled";
              return (
                <li key={booking.id}>
                  <Link
                    href={`${base}/${booking.id}`}
                    className={`${surfaceLinkRow} grid gap-1 sm:grid-cols-[8rem_minmax(0,1fr)_auto] sm:items-center sm:gap-4`}
                  >
                    <span
                      className={cn(
                        "font-medium tabular-nums",
                        cancelled && "text-muted-foreground line-through",
                      )}
                    >
                      {formatLocalTime(booking.starts_at, business.timezone)}-
                      {formatLocalTime(booking.ends_at, business.timezone)}
                    </span>
                    <span className="grid min-w-0 gap-0.5">
                      <span>
                        <span dir="auto" className="font-medium">
                          {booking.customers.name}
                        </span>{" "}
                        · <ServiceName service={booking.services} /> with{" "}
                        <span dir="auto">{booking.staff.name}</span>
                      </span>
                      <span
                        className="justify-self-start text-small text-muted-foreground"
                        dir="ltr"
                      >
                        {formatPhone(booking.customers.phone)}
                      </span>
                    </span>
                    {cancelled ? (
                      <Badge
                        tone="danger"
                        icon={<XCircle aria-hidden="true" />}
                        className="justify-self-start"
                      >
                        Cancelled
                      </Badge>
                    ) : (
                      <span className="text-small text-muted-foreground tabular-nums">
                        {booking.reference}
                      </span>
                    )}
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
