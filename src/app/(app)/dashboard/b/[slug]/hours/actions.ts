"use server";

import { refresh } from "next/cache";
import { z } from "zod";
import { memberForAction } from "@/lib/business";
import { closingTime, scheduleProblem } from "@/lib/hours";

export type HoursFormState = { error: string | null; saved: boolean };

const spansSchema = z
  .array(
    z.object({
      weekday: z.number().int(),
      opensAt: z.string(),
      closesAt: z.string(),
    }),
  )
  .max(70, "That's too many spans for one week.");

// Postgres error codes: overlapping spans (exclusion constraint), and a staff member that isn't
// this business's (composite foreign key).
const OVERLAP = "23P01";
const FOREIGN_KEY_VIOLATION = "23503";

/**
 * Replaces a weekly schedule: the business's when `staffId` is null, else that staff member's.
 * A staff member who "works the business's hours" gets an empty schedule of their own.
 */
export async function setHours(
  slug: string,
  staffId: string | null,
  _previous: HoursFormState,
  formData: FormData,
): Promise<HoursFormState> {
  const { supabase, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/hours`,
  );
  if (!member || member.role === "staff") {
    return { error: "Only owners and admins can change hours.", saved: false };
  }

  let submitted: unknown;
  try {
    submitted =
      staffId && formData.get("useBusinessHours") === "on"
        ? []
        : JSON.parse(String(formData.get("spans") ?? "[]"));
  } catch {
    return {
      error: "We couldn't read the hours. Please try again.",
      saved: false,
    };
  }
  const parsed = spansSchema.safeParse(submitted);
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null, saved: false };
  }
  const spans = parsed.data.map((span) => ({
    ...span,
    closesAt: closingTime(span.closesAt),
  }));
  const problem = scheduleProblem(spans);
  if (problem) return { error: problem, saved: false };

  // One transaction under the user's RLS: the whole week is replaced, or nothing changes.
  const { error } = await supabase.rpc("set_working_hours", {
    target_business_id: member.business.id,
    // Left out for the business's own hours.
    target_staff_id: staffId ?? undefined,
    spans: spans.map((span) => ({
      weekday: span.weekday,
      opens_at: span.opensAt,
      closes_at: span.closesAt,
    })),
  });
  if (error) {
    if (error.code === OVERLAP) {
      return { error: "Some of the hours overlap.", saved: false };
    }
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return { error: "That staff member no longer exists.", saved: false };
    }
    console.error("Saving hours failed", { code: error.code });
    return {
      error: "We couldn't save the hours. Please try again.",
      saved: false,
    };
  }

  refresh();
  return { error: null, saved: true };
}
