import { randomUUID } from "node:crypto";
import type { Metadata } from "next";
import Link from "next/link";
import { createBooking } from "@/app/(app)/dashboard/b/[slug]/bookings/actions";
import { NewBookingForm } from "@/app/(app)/dashboard/b/[slug]/bookings/booking-forms";
import { freeTimes } from "@/app/(app)/dashboard/b/[slug]/bookings/free-times";
import { BusinessHeader } from "@/app/(app)/dashboard/b/[slug]/business-header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import { requireMemberBusiness } from "@/lib/business";
import { formatDay, isIsoDate, todayIn } from "@/lib/dates";

export const metadata: Metadata = { title: "New booking" };

export default async function NewBookingPage({
  params,
  searchParams,
}: PageProps<"/dashboard/b/[slug]/bookings/new">) {
  const { slug } = await params;
  const query = await searchParams;
  const { supabase, business, role } = await requireMemberBusiness(
    slug,
    `/dashboard/b/${slug}/bookings/new`,
  );

  const [servicesResult, staffResult] = await Promise.all([
    supabase
      .from("services")
      .select("id, name_en, name_ar")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("created_at"),
    supabase
      .from("staff")
      .select("id, name, staff_services (service_id)")
      .eq("business_id", business.id)
      .eq("active", true)
      .order("created_at"),
  ]);
  if (servicesResult.error) {
    throw new Error(`Could not load services: ${servicesResult.error.message}`);
  }
  if (staffResult.error) {
    throw new Error(`Could not load staff: ${staffResult.error.message}`);
  }
  const services = servicesResult.data;

  // Step one is a plain GET form (service, staff, day); its choices come back in the URL.
  const today = todayIn(business.timezone);
  const service = services.find((option) => option.id === query.service);
  const performers = service
    ? staffResult.data.filter((person) =>
        person.staff_services.some((link) => link.service_id === service.id),
      )
    : staffResult.data;
  const staffId =
    performers.find((person) => person.id === query.staff)?.id ?? null;
  const day =
    typeof query.day === "string" && isIsoDate(query.day) ? query.day : today;
  const times = service
    ? await freeTimes(supabase, {
        serviceId: service.id,
        day,
        staffId,
        timeZone: business.timezone,
      })
    : [];

  return (
    <>
      <BusinessHeader business={business} role={role} current="bookings" />

      <section className="grid gap-4" aria-labelledby="new-booking-heading">
        <div className="grid gap-1">
          <h2 id="new-booking-heading" className="text-lg font-semibold">
            New booking
          </h2>
          <p className="text-sm text-muted-foreground">
            Only free times are shown, in{" "}
            {business.timezone.replaceAll("_", " ")} time.
          </p>
        </div>

        {services.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            There&apos;s nothing to book yet. Add a service on the{" "}
            <Link
              href={`/dashboard/b/${business.slug}/services`}
              className="underline underline-offset-4"
            >
              Services
            </Link>{" "}
            tab first.
          </p>
        ) : (
          <form className="grid gap-3 rounded-lg border p-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <div className="grid gap-2">
              <Label htmlFor="service">Service</Label>
              <NativeSelect
                id="service"
                name="service"
                className="w-full"
                defaultValue={service?.id ?? ""}
                required
              >
                <NativeSelectOption value="" disabled>
                  Choose a service
                </NativeSelectOption>
                {services.map((option) => (
                  <NativeSelectOption
                    key={option.id}
                    value={option.id}
                    lang={option.name_en ? "en" : "ar"}
                  >
                    {option.name_en ?? option.name_ar}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="staff">With</Label>
              <NativeSelect
                id="staff"
                name="staff"
                className="w-full"
                defaultValue={staffId ?? ""}
              >
                <NativeSelectOption value="">
                  Anyone available
                </NativeSelectOption>
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
                min={today}
                defaultValue={day}
                required
              />
            </div>
            <div className="sm:col-span-3">
              <Button type="submit" variant="outline">
                Show free times
              </Button>
            </div>
          </form>
        )}

        {service &&
          (times.length === 0 ? (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">
              No free times on {formatDay(day)}. Try another day
              {staffId ? ", or anyone available" : ""}.
            </p>
          ) : (
            <NewBookingForm
              // A fresh form (and idempotency key) for each search.
              key={`${service.id}-${staffId}-${day}`}
              action={createBooking.bind(null, business.slug)}
              times={times}
              serviceId={service.id}
              staffId={staffId}
              idempotencyKey={randomUUID()}
              defaultLanguage={business.default_language}
            />
          ))}
      </section>
    </>
  );
}
