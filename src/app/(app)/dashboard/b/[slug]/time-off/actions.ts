"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import type { ActionState } from "@/components/action-button";
import { memberForAction } from "@/lib/business";

export type AddFormState = { error: string | null; added: number };

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const reason = z
  .string()
  .trim()
  .max(200, "Keep the reason under 200 characters.");

// What <input type="datetime-local"> and <input type="date"> send: local wall-clock values.
const localDateTime = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/, "Enter a date and time.");
const localDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a date.");

const timeOffSchema = z
  .object({
    staffId: z.uuid("Choose a staff member."),
    startsAt: localDateTime,
    endsAt: localDateTime,
    reason,
  })
  // Same format on both sides, so comparing the text compares the times.
  .refine((timeOff) => timeOff.endsAt > timeOff.startsAt, {
    message: "The time off must end after it starts.",
  });

const closureSchema = z
  .object({ startsOn: localDate, endsOn: localDate, reason })
  .refine((closure) => closure.endsOn >= closure.startsOn, {
    message: "The last day can't be before the first.",
  });

async function managerFor(slug: string) {
  const { supabase, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/time-off`,
  );
  return {
    supabase,
    business: member && member.role !== "staff" ? member.business : null,
  };
}

/** Adds time off for a staff member, from times in the business's local time. */
export async function addTimeOff(
  slug: string,
  previous: AddFormState,
  formData: FormData,
): Promise<AddFormState> {
  const { supabase, business } = await managerFor(slug);
  if (!business) {
    return {
      error: "Only owners and admins can add time off.",
      added: previous.added,
    };
  }
  const parsed = timeOffSchema.safeParse({
    staffId: formText(formData, "staffId"),
    startsAt: formText(formData, "startsAt"),
    endsAt: formText(formData, "endsAt"),
    reason: formText(formData, "reason"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? null,
      added: previous.added,
    };
  }

  // The database converts the local times to UTC with the business's time zone.
  const { data: id, error } = await supabase.rpc("add_time_off", {
    target_staff_id: parsed.data.staffId,
    starts_local: parsed.data.startsAt,
    ends_local: parsed.data.endsAt,
    time_off_reason: parsed.data.reason,
  });
  if (error) {
    console.error("Adding time off failed", { code: error.code });
    return {
      error: "We couldn't add the time off. Please try again.",
      added: previous.added,
    };
  }
  if (!id) {
    return {
      error: "That staff member no longer exists.",
      added: previous.added,
    };
  }

  refresh();
  return { error: null, added: previous.added + 1 };
}

/** Closes the whole business for one or more days. */
export async function addClosure(
  slug: string,
  previous: AddFormState,
  formData: FormData,
): Promise<AddFormState> {
  const { supabase, business } = await managerFor(slug);
  if (!business) {
    return {
      error: "Only owners and admins can close the business.",
      added: previous.added,
    };
  }
  const parsed = closureSchema.safeParse({
    startsOn: formText(formData, "startsOn"),
    endsOn: formText(formData, "endsOn"),
    reason: formText(formData, "reason"),
  });
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? null,
      added: previous.added,
    };
  }

  const { error } = await supabase.from("closures").insert({
    business_id: business.id,
    starts_on: parsed.data.startsOn,
    ends_on: parsed.data.endsOn,
    reason: parsed.data.reason || null,
  });
  if (error) {
    console.error("Adding a closure failed", { code: error.code });
    return {
      error: "We couldn't add the closure. Please try again.",
      added: previous.added,
    };
  }

  refresh();
  return { error: null, added: previous.added + 1 };
}

export async function removeTimeOff(
  slug: string,
  timeOffId: string,
): Promise<ActionState> {
  const { supabase, business } = await managerFor(slug);
  if (!business)
    return { error: "Only owners and admins can remove time off." };

  const { data: removed, error } = await supabase
    .from("time_off")
    .delete()
    .eq("id", timeOffId)
    .eq("business_id", business.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Removing time off failed", { code: error.code });
    return { error: "We couldn't remove it. Please try again." };
  }
  if (!removed) return { error: "That time off was already removed." };

  refresh();
  return { error: null };
}

export async function removeClosure(
  slug: string,
  closureId: string,
): Promise<ActionState> {
  const { supabase, business } = await managerFor(slug);
  if (!business)
    return { error: "Only owners and admins can remove closures." };

  const { data: removed, error } = await supabase
    .from("closures")
    .delete()
    .eq("id", closureId)
    .eq("business_id", business.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Removing a closure failed", { code: error.code });
    return { error: "We couldn't remove it. Please try again." };
  }
  if (!removed) return { error: "That closure was already removed." };

  refresh();
  return { error: null };
}
