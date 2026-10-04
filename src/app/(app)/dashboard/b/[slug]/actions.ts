"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import {
  CANCELLATION_HOURS,
  NOTICE_MINUTES,
  SLOT_INTERVALS,
} from "@/lib/booking-rules";
import { memberForAction } from "@/lib/business";
import { timeZoneOptions } from "@/lib/time-zones";

export type SettingsFormState = { error: string | null; saved: boolean };

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const oneOf = (values: readonly number[], message: string) =>
  z.coerce.number().refine((value) => values.includes(value), { message });

const detailsSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter your business's name.")
    .max(100, "Keep the name under 100 characters."),
  timezone: z.string().refine((zone) => timeZoneOptions().includes(zone), {
    message: "Choose a time zone from the list.",
  }),
  defaultLanguage: z.enum(["en", "ar"], "Choose English or Arabic."),
});

const rulesSchema = z.object({
  noticeMinutes: oneOf(NOTICE_MINUTES, "Choose a minimum notice."),
  horizonDays: z.coerce
    .number("Enter how many days ahead people can book.")
    .int("Enter whole days.")
    .min(1, "Allow booking at least 1 day ahead.")
    .max(365, "Allow booking at most 365 days ahead."),
  slotInterval: oneOf(SLOT_INTERVALS, "Choose how often appointments start."),
  cancellationHours: oneOf(CANCELLATION_HOURS, "Choose a cancellation notice."),
});

async function managerFor(slug: string) {
  const { supabase, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}`,
  );
  return {
    supabase,
    business: member && member.role !== "staff" ? member.business : null,
  };
}

/** The business's name, time zone and the assistant's first language. The slug never changes. */
export async function updateDetails(
  slug: string,
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const { supabase, business } = await managerFor(slug);
  if (!business) {
    return {
      error: "Only owners and admins can change the business.",
      saved: false,
    };
  }
  const parsed = detailsSchema.safeParse({
    name: formText(formData, "name"),
    timezone: formText(formData, "timezone"),
    defaultLanguage: formText(formData, "defaultLanguage"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null, saved: false };
  }

  // Through RLS as the user: owners and admins may change exactly these columns.
  const { error } = await supabase
    .from("businesses")
    .update({
      name: parsed.data.name,
      timezone: parsed.data.timezone,
      default_language: parsed.data.defaultLanguage,
    })
    .eq("id", business.id);
  if (error) {
    console.error("Updating a business failed", { code: error.code });
    return {
      error: "We couldn't save the details. Please try again.",
      saved: false,
    };
  }

  refresh();
  return { error: null, saved: true };
}

/** The rules availability and the assistant enforce. */
export async function updateRules(
  slug: string,
  _previous: SettingsFormState,
  formData: FormData,
): Promise<SettingsFormState> {
  const { supabase, business } = await managerFor(slug);
  if (!business) {
    return {
      error: "Only owners and admins can change booking rules.",
      saved: false,
    };
  }
  const parsed = rulesSchema.safeParse({
    noticeMinutes: formText(formData, "noticeMinutes"),
    horizonDays: formText(formData, "horizonDays"),
    slotInterval: formText(formData, "slotInterval"),
    cancellationHours: formText(formData, "cancellationHours"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null, saved: false };
  }

  const { error } = await supabase
    .from("businesses")
    .update({
      booking_notice_minutes: parsed.data.noticeMinutes,
      booking_horizon_days: parsed.data.horizonDays,
      slot_interval_minutes: parsed.data.slotInterval,
      cancellation_notice_hours: parsed.data.cancellationHours,
    })
    .eq("id", business.id);
  if (error) {
    console.error("Updating booking rules failed", { code: error.code });
    return {
      error: "We couldn't save the rules. Please try again.",
      saved: false,
    };
  }

  refresh();
  return { error: null, saved: true };
}
