"use server";

import { refresh } from "next/cache";
import { memberForAction } from "@/lib/business";
import { parseOrigins } from "@/lib/widget/origins";

export type WidgetFormState = {
  error: string | null;
  saved: boolean;
  enabled: boolean;
  origins: string;
};

export async function saveWidgetSettings(
  slug: string,
  _previous: WidgetFormState,
  formData: FormData,
): Promise<WidgetFormState> {
  const typed = String(formData.get("origins") ?? "");
  const enabled = formData.get("enabled") === "on";
  // The form keeps what was entered, so a refused save loses nothing.
  const failed = (error: string) => ({
    error,
    saved: false,
    enabled,
    origins: typed,
  });
  const { supabase, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/widget`,
  );
  if (!member || member.role === "staff") {
    return failed("Only owners and admins can change the widget.");
  }
  const origins = parseOrigins(typed);
  if (!Array.isArray(origins)) return failed(origins.error);
  if (enabled && origins.length === 0) {
    return failed("Add the website the widget goes on before turning it on.");
  }

  const { error } = await supabase
    .from("businesses")
    .update({ widget_enabled: enabled, widget_origins: origins })
    .eq("id", member.business.id);
  if (error) {
    console.error("Saving the widget settings failed", { code: error.code });
    return failed("We couldn't save the settings. Please try again.");
  }

  refresh();
  return { error: null, saved: true, enabled, origins: origins.join("\n") };
}
