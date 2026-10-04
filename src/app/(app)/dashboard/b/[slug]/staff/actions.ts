"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/action-button";
import { memberForAction } from "@/lib/business";

export type StaffFormState = {
  error: string | null;
  fields: { name?: string; serviceIds?: string[] };
};

const staffSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, "Enter the staff member's name.")
    .max(80, "Keep the name under 80 characters."),
  serviceIds: z.array(z.uuid("Choose services from the list.")),
});

function readStaffMember(formData: FormData) {
  const name = formData.get("name");
  const fields = {
    name: typeof name === "string" ? name : "",
    serviceIds: formData
      .getAll("serviceIds")
      .filter((value): value is string => typeof value === "string"),
  };
  return { fields, parsed: staffSchema.safeParse(fields) };
}

// The composite foreign keys refuse a service from another business.
const FOREIGN_KEY_VIOLATION = "23503";

export async function createStaffMember(
  slug: string,
  _previous: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const { supabase, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/staff/new`,
  );
  const { fields, parsed } = readStaffMember(formData);
  if (!member || member.role === "staff") {
    return { error: "Only owners and admins can add staff.", fields };
  }
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null, fields };
  }

  // One transaction under the user's RLS: the staff member and their services, or neither.
  const { error } = await supabase.rpc("create_staff_member", {
    target_business_id: member.business.id,
    member_name: parsed.data.name,
    service_ids: parsed.data.serviceIds,
  });
  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return { error: "Choose services from the list.", fields };
    }
    console.error("Adding a staff member failed", { code: error.code });
    return {
      error: "We couldn't add the staff member. Please try again.",
      fields,
    };
  }

  redirect(`/dashboard/b/${slug}/staff`);
}

export async function updateStaffMember(
  slug: string,
  staffId: string,
  _previous: StaffFormState,
  formData: FormData,
): Promise<StaffFormState> {
  const { supabase, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/staff/${staffId}`,
  );
  const { fields, parsed } = readStaffMember(formData);
  if (!member || member.role === "staff") {
    return { error: "Only owners and admins can change staff.", fields };
  }
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null, fields };
  }

  const { data: updated, error } = await supabase.rpc("update_staff_member", {
    target_staff_id: staffId,
    member_name: parsed.data.name,
    service_ids: parsed.data.serviceIds,
  });
  if (error) {
    if (error.code === FOREIGN_KEY_VIOLATION) {
      return { error: "Choose services from the list.", fields };
    }
    console.error("Updating a staff member failed", {
      staffId,
      code: error.code,
    });
    return {
      error: "We couldn't save the staff member. Please try again.",
      fields,
    };
  }
  if (!updated) return { error: "That staff member no longer exists.", fields };

  redirect(`/dashboard/b/${slug}/staff`);
}

/** Archives a staff member (customers can't book them any more) or brings them back. */
export async function setStaffActive(
  slug: string,
  staffId: string,
  active: boolean,
): Promise<ActionState> {
  const { supabase, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/staff`,
  );
  if (!member || member.role === "staff") {
    return { error: "Only owners and admins can change staff." };
  }

  const { data: updated, error } = await supabase
    .from("staff")
    .update({ active })
    .eq("id", staffId)
    .eq("business_id", member.business.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Archiving a staff member failed", {
      staffId,
      code: error.code,
    });
    return { error: "We couldn't update the staff member. Please try again." };
  }
  if (!updated) return { error: "That staff member no longer exists." };

  refresh();
  return { error: null };
}
