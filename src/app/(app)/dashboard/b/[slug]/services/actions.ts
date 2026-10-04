"use server";

import { refresh } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { ActionState } from "@/components/action-button";
import { memberForAction } from "@/lib/business";
import { parseAmount, PRICE_CURRENCIES } from "@/lib/money";

export type ServiceFormFields = {
  nameEn?: string;
  nameAr?: string;
  duration?: string;
  buffer?: string;
  price?: string;
  currency?: string;
};

export type ServiceFormState = {
  error: string | null;
  fields: ServiceFormFields;
};

function formText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

const optionalName = z
  .string()
  .trim()
  .max(80, "Keep each name under 80 characters.")
  .transform((name) => name || null);

const minutes = (label: string, min: number, max: number) =>
  z.coerce
    .number(`Enter the ${label} in minutes.`)
    .int(`Enter the ${label} in whole minutes.`)
    .min(min, `The ${label} must be at least ${min} minutes.`)
    .max(max, `The ${label} must be at most ${max} minutes.`)
    .refine((value) => value % 5 === 0, {
      message: `Use 5-minute steps for the ${label}.`,
    });

// Mirrors the services table's checks, so people see the reason before the database refuses.
const serviceSchema = z
  .object({
    nameEn: optionalName,
    nameAr: optionalName,
    duration: minutes("duration", 5, 720),
    buffer: minutes("buffer", 0, 240),
    currency: z.enum(PRICE_CURRENCIES, "Choose a currency."),
    price: z.string(),
  })
  .refine((service) => service.nameEn || service.nameAr, {
    message: "Give the service a name in English, Arabic or both.",
  })
  .transform((service, ctx) => {
    const price = parseAmount(service.price, service.currency);
    if (price === null) {
      ctx.addIssue(`Enter a price like 250 or 249.50 in ${service.currency}.`);
      return z.NEVER;
    }
    return { ...service, price };
  });

function readService(formData: FormData) {
  const fields: ServiceFormFields = {
    nameEn: formText(formData, "nameEn"),
    nameAr: formText(formData, "nameAr"),
    duration: formText(formData, "duration"),
    buffer: formText(formData, "buffer"),
    price: formText(formData, "price"),
    currency: formText(formData, "currency"),
  };
  return { fields, parsed: serviceSchema.safeParse(fields) };
}

export async function createService(
  slug: string,
  _previous: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const { supabase, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/services/new`,
  );
  const { fields, parsed } = readService(formData);
  if (!member || member.role === "staff") {
    return { error: "Only owners and admins can add services.", fields };
  }
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null, fields };
  }

  // Through RLS as the user: the database decides who may add services, and where.
  const service = parsed.data;
  const { error } = await supabase.from("services").insert({
    business_id: member.business.id,
    name_en: service.nameEn,
    name_ar: service.nameAr,
    duration_minutes: service.duration,
    buffer_minutes: service.buffer,
    price: service.price,
    currency: service.currency,
  });
  if (error) {
    console.error("Adding a service failed", { code: error.code });
    return { error: "We couldn't add the service. Please try again.", fields };
  }

  redirect(`/dashboard/b/${slug}/services`);
}

export async function updateService(
  slug: string,
  serviceId: string,
  _previous: ServiceFormState,
  formData: FormData,
): Promise<ServiceFormState> {
  const { supabase, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/services/${serviceId}`,
  );
  const { fields, parsed } = readService(formData);
  if (!member || member.role === "staff") {
    return { error: "Only owners and admins can change services.", fields };
  }
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? null, fields };
  }

  const service = parsed.data;
  const { data: updated, error } = await supabase
    .from("services")
    .update({
      name_en: service.nameEn,
      name_ar: service.nameAr,
      duration_minutes: service.duration,
      buffer_minutes: service.buffer,
      price: service.price,
      currency: service.currency,
    })
    .eq("id", serviceId)
    .eq("business_id", member.business.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Updating a service failed", { serviceId, code: error.code });
    return {
      error: "We couldn't save the service. Please try again.",
      fields,
    };
  }
  if (!updated) return { error: "That service no longer exists.", fields };

  redirect(`/dashboard/b/${slug}/services`);
}

/** Archives a service (customers can't book it any more) or brings it back. */
export async function setServiceActive(
  slug: string,
  serviceId: string,
  active: boolean,
): Promise<ActionState> {
  const { supabase, member } = await memberForAction(
    slug,
    `/dashboard/b/${slug}/services`,
  );
  if (!member || member.role === "staff") {
    return { error: "Only owners and admins can change services." };
  }

  const { data: updated, error } = await supabase
    .from("services")
    .update({ active })
    .eq("id", serviceId)
    .eq("business_id", member.business.id)
    .select("id")
    .maybeSingle();
  if (error) {
    console.error("Archiving a service failed", {
      serviceId,
      code: error.code,
    });
    return { error: "We couldn't update the service. Please try again." };
  }
  if (!updated) return { error: "That service no longer exists." };

  refresh();
  return { error: null };
}
