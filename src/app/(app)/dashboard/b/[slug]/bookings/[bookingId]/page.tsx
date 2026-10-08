import { randomUUID } from "node:crypto";
import { ArrowLeft, CheckCircle, XCircle } from "@phosphor-icons/react/ssr";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { notFound } from "next/navigation";
import {
  cancelBooking,
  moveBooking,
} from "@/app/(app)/dashboard/b/[slug]/bookings/actions";
import { MoveBookingForm } from "@/app/(app)/dashboard/b/[slug]/bookings/booking-forms";
import { freeTimes } from "@/app/(app)/dashboard/b/[slug]/bookings/free-times";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { ActionButton } from "@/components/action-button";
import { Badge } from "@/components/badge";
import { FormDone } from "@/components/form-feedback";
import { SectionHeader } from "@/components/section-header";
import { ServiceName } from "@/components/service-name";
import { surface } from "@/components/surface";
import { Button, buttonVariants } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { requireMemberBusiness } from "@/lib/business";
import {
  formatDay,
  formatLocalDateTime,
  formatLocalTime,
  isIsoDate,
  todayIn,
} from "@/lib/dates";
import { languageNames } from "@/lib/languages";
import { formatAmount } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

export const metadata: Metadata = { title: "Booking" };

function Detail({ term, children }: { term: string; children: ReactNode }) {
  return (
    <div className="contents">
      <dt className="text-small text-muted-foreground sm:pt-0.5">{term}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function BookingPage({
  params,
  searchParams,
}: PageProps<"/dashboard/b/[slug]/bookings/[bookingId]">) {
  const { slug, bookingId } = await params;
  const query = await searchParams;
  const { supabase, business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/bookings/${bookingId}`,
  );

  const { data: booking, error } = await supabase
    .from("bookings")
    .select(
      "id, reference, service_id, staff_id, starts_at, ends_at, status, price, currency, notes, cancelled_at, customers (name, phone, email, language), services (name_en, name_ar), staff (name)",
    )
    .eq("id", bookingId)
    .eq("business_id", business.id)
    .maybeSingle();
  // A malformed id is just a booking that doesn't exist.
  if (error && error.code !== "22P02") {
    throw new Error(`Could not load the booking: ${error.message}`);
  }
  if (!booking) notFound();

  const timeZone = business.timezone;
  const bookingDay = todayIn(timeZone, new Date(booking.starts_at));
  const changeable =
    booking.status === "confirmed" && new Date(booking.starts_at) > new Date();
  const bookingsPath = `/dashboard/b/${business.slug}/bookings`;

  // Moving: free times for the chosen day and staff member, as if this booking weren't there.
  const moveDay =
    typeof query.day === "string" && isIsoDate(query.day)
      ? query.day
      : bookingDay;
  let performers: { id: string; name: string }[] = [];
  let moveStaffId = booking.staff_id;
  let moveTimes: Awaited<ReturnType<typeof freeTimes>> = [];
  if (changeable) {
    const { data: staff, error: staffError } = await supabase
      .from("staff")
      .select("id, name, staff_services!inner (service_id)")
      .eq("business_id", business.id)
      .eq("active", true)
      .eq("staff_services.service_id", booking.service_id)
      .order("created_at");
    if (staffError) {
      throw new Error(`Could not load staff: ${staffError.message}`);
    }
    performers = staff;
    moveStaffId =
      performers.find((person) => person.id === query.staff)?.id ??
      booking.staff_id;
    moveTimes = (
      await freeTimes(supabase, {
        serviceId: booking.service_id,
        day: moveDay,
        staffId: moveStaffId,
        timeZone,
        ignoredBookingId: booking.id,
      })
    ).filter(
      // Its current time, with the same person, isn't a move.
      (time) =>
        !(
          moveStaffId === booking.staff_id &&
          new Date(time.value).getTime() ===
            new Date(booking.starts_at).getTime()
        ),
    );
  }

  return (
    <>
      <BusinessHeader business={business} role={role} current="bookings" />

      <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_20rem] lg:items-start">
        <div className="grid min-w-0 gap-10">
          <section className="grid gap-4" aria-labelledby="booking-heading">
            <SectionHeader
              id="booking-heading"
              title={`Booking ${booking.reference}`}
              action={
                <Link
                  href={`${bookingsPath}?day=${bookingDay}`}
                  className={buttonVariants({ variant: "ghost", size: "sm" })}
                >
                  <ArrowLeft aria-hidden="true" className="rtl:-scale-x-100" />
                  All bookings on {formatDay(bookingDay)}
                </Link>
              }
            />
            {(query.booked || query.moved) &&
              booking.status === "confirmed" && (
                <FormDone>{query.moved ? "Moved." : "Booked."}</FormDone>
              )}
            <dl
              className={`${surface} grid gap-x-8 gap-y-3 p-5 sm:grid-cols-[auto_minmax(0,1fr)] sm:p-6`}
            >
              <Detail term="Status">
                {booking.cancelled_at ? (
                  <Badge tone="danger" icon={<XCircle aria-hidden="true" />}>
                    Cancelled on{" "}
                    {formatLocalDateTime(booking.cancelled_at, timeZone)}
                  </Badge>
                ) : (
                  <Badge
                    tone="success"
                    icon={<CheckCircle aria-hidden="true" weight="fill" />}
                  >
                    Confirmed
                  </Badge>
                )}
              </Detail>
              <Detail term="When">
                <span className="tabular-nums">
                  {formatLocalDateTime(booking.starts_at, timeZone)} to{" "}
                  {formatLocalTime(booking.ends_at, timeZone)}
                </span>
              </Detail>
              <Detail term="Service">
                <ServiceName service={booking.services} />
              </Detail>
              <Detail term="With">
                <span dir="auto">{booking.staff.name}</span>
              </Detail>
              <Detail term="Customer">
                <span dir="auto">{booking.customers.name}</span>
              </Detail>
              <Detail term="Phone">
                <a
                  href={`tel:${booking.customers.phone}`}
                  dir="ltr"
                  className="text-accent-foreground underline-offset-4 hover:underline"
                >
                  {formatPhone(booking.customers.phone)}
                </a>
              </Detail>
              {booking.customers.email && (
                <Detail term="Email">
                  <span dir="ltr">{booking.customers.email}</span>
                </Detail>
              )}
              <Detail term="Speaks">
                <span lang={booking.customers.language}>
                  {languageNames[booking.customers.language]}
                </span>
              </Detail>
              <Detail term="Price">
                <span className="tabular-nums">
                  {formatAmount(booking.price, booking.currency)}
                </span>
              </Detail>
              {booking.notes && (
                <Detail term="Notes">
                  <span dir="auto">{booking.notes}</span>
                </Detail>
              )}
            </dl>
          </section>

          {changeable && (
            <section className="grid gap-4" aria-labelledby="move-heading">
              <SectionHeader
                id="move-heading"
                title="Move booking"
                description="Free times only, as if this booking weren't there."
              />
              <form
                className={`${surface} grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] sm:items-end sm:p-6`}
              >
                <div className="grid gap-2">
                  <Label htmlFor="staff">With</Label>
                  <NativeSelect
                    id="staff"
                    name="staff"
                    className="w-full"
                    defaultValue={moveStaffId}
                  >
                    {performers.map((person) => (
                      <NativeSelectOption key={person.id} value={person.id}>
                        {person.name}
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="day">Day</Label>
                  <Input
                    id="day"
                    name="day"
                    type="date"
                    min={todayIn(timeZone)}
                    defaultValue={moveDay}
                    required
                  />
                </div>
                <Button
                  type="submit"
                  variant="outline"
                  className="justify-self-start"
                >
                  Show free times
                </Button>
              </form>
              {moveTimes.length === 0 ? (
                <p className="text-secondary-foreground">
                  No other free times on {formatDay(moveDay)}. Try another day.
                </p>
              ) : (
                <MoveBookingForm
                  key={`${moveStaffId}-${moveDay}`}
                  action={moveBooking.bind(null, business.slug, booking.id)}
                  times={moveTimes}
                  staffId={moveStaffId}
                  idempotencyKey={randomUUID()}
                />
              )}
            </section>
          )}
        </div>

        {changeable && (
          <section
            className={`${surface} grid gap-3 p-5 sm:p-6 lg:sticky lg:top-6`}
            aria-labelledby="cancel-heading"
          >
            <h2 id="cancel-heading" className="text-h3">
              Cancel booking
            </h2>
            <p className="text-secondary-foreground">
              Cancelling frees the time for other customers.
            </p>
            <ActionButton
              action={cancelBooking.bind(
                null,
                business.slug,
                booking.id,
                randomUUID(),
              )}
              label="Cancel booking"
              pendingLabel="Cancelling..."
              variant="destructive"
            />
          </section>
        )}
      </div>
    </>
  );
}
