"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/action-button";
import { bookingErrorMessage } from "@/lib/booking-errors";
import { memberForAction } from "@/lib/business";
import { normalizePhone } from "@/lib/phone";

// Every member (owners, admins and staff) can book, move and cancel: taking bookings is
// front-desk work. The database functions check membership and the business's rules again.

export type BookingFormFields = {
  startsAt?: string;
  name?: string;
  phone?: string;
  email?: string;
  language?: string;
  notes?: string;
};

export type BookingFormState = {
  error: string | null;
  fields: BookingFormFields;
};

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

// A start time as the slot picker sends it: the ISO moment from available_slots.
const startsAt = z.iso.datetime({ offset: true, message: "Choose a time." });
// "Anyone available" sends an empty staff id.
const optionalStaffId = z
  .union([z.uuid(), z.literal("")])
  .transform((id) => id || undefined);
// One per rendered form, so a double-clicked or retried submit can't act twice.
const idempotencyKey = z.uuid("Reload the page and try again.");

const newBookingSchema = z.object({
  serviceId: z.uuid("Choose a service."),
  staffId: optionalStaffId,
  startsAt,
  name: z
    .string()
    .trim()
    .min(1, "Enter the customer's name.")
    .max(80, "Keep the name under 80 characters."),
  phone: z.string().transform((text, ctx) => {
    const phone = normalizePhone(text);
    if (!phone) {
      ctx.addIssue(
        "Enter the phone number with its country code, like +20 10 1234 5678.",
      );
      return z.NEVER;
    }
    return phone;
  }),
  email: z
    .union([
      z.literal(""),
      z.email("Enter a valid email address, or leave it empty."),
    ])
    .transform((email) => email || undefined),
  language: z.enum(["en", "ar"], "Choose English or Arabic."),
  notes: z
    .string()
    .trim()
    .max(500, "Keep the notes under 500 characters.")
    .transform((notes) => notes || undefined),
  idempotencyKey,
});

const moveSchema = z.object({
  startsAt,
  staffId: optionalStaffId,
  idempotencyKey,
});

/**
 * Explains a failed booking call. Refusals (taken, too soon, ...) get their own message and
 * refresh the page, so the time list drops what is no longer free; anything else is logged.
 */
function failureMessage(error: { code: string }, fallback: string) {
  const message = bookingErrorMessage(error.code);
  if (message) {
    refresh();
    return message;
  }
  console.error("A booking call failed", { code: error.code });
  return fallback;
}

export async function createBooking(
  slug: string,
  _previous: BookingFormState,
  formData: FormData,
): Promise<BookingFormState> {
  const fields: BookingFormFields = {
    startsAt: formText(formData, "startsAt"),
    name: formText(formData, "name"),
    phone: formText(formData, "phone"),
    email: formText(formData, "email"),
    language: formText(formData, "language"),
    notes: formText(formData, "notes"),
  };
  const { supabase, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/bookings/new`,
  );
  if (!member) {
    return { error: "You're no longer a member of this business.", fields };
  }
  const parsed = newBookingSchema.safeParse({
    ...fields,
    serviceId: formText(formData, "serviceId"),
    staffId: formText(formData, "staffId"),
    idempotencyKey: formText(formData, "idempotencyKey"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null, fields };
  }

  const { data: booking, error } = await supabase.rpc("book_appointment", {
    target_service_id: parsed.data.serviceId,
    requested_start: parsed.data.startsAt,
    customer_name: parsed.data.name,
    customer_phone: parsed.data.phone,
    idempotency_key: parsed.data.idempotencyKey,
    target_staff_id: parsed.data.staffId,
    customer_email: parsed.data.email,
    customer_language: parsed.data.language,
    booking_notes: parsed.data.notes,
  });
  if (error) {
    return {
      error: failureMessage(error, "We couldn't book it. Please try again."),
      fields,
    };
  }

  redirect(`/dashboard/b/${slug}/bookings/${booking.id}?booked=1`);
}

export async function moveBooking(
  slug: string,
  bookingId: string,
  _previous: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { supabase, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/bookings/${bookingId}`,
  );
  if (!member) return { error: "You're no longer a member of this business." };
  const parsed = moveSchema.safeParse({
    startsAt: formText(formData, "startsAt"),
    staffId: formText(formData, "staffId"),
    idempotencyKey: formText(formData, "idempotencyKey"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null };
  }

  const { error } = await supabase.rpc("reschedule_booking", {
    target_booking_id: bookingId,
    new_start: parsed.data.startsAt,
    idempotency_key: parsed.data.idempotencyKey,
    target_staff_id: parsed.data.staffId,
  });
  if (error) {
    return {
      error: failureMessage(error, "We couldn't move it. Please try again."),
    };
  }

  redirect(`/dashboard/b/${slug}/bookings/${bookingId}?moved=1`);
}

export async function cancelBooking(
  slug: string,
  bookingId: string,
  idempotencyKey: string,
): Promise<ActionState> {
  const { supabase, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/bookings/${bookingId}`,
  );
  if (!member) return { error: "You're no longer a member of this business." };

  const { error } = await supabase.rpc("cancel_booking", {
    target_booking_id: bookingId,
    idempotency_key: idempotencyKey,
  });
  if (error) {
    return {
      error: failureMessage(error, "We couldn't cancel it. Please try again."),
    };
  }

  refresh();
  return { error: null };
}
