import { createClient } from "@supabase/supabase-js";
import { slugify } from "@/lib/slug";
import { adminClient, supabaseSettings } from "./supabase";

export function uniqueBusinessName(base: string) {
  return `${base} ${crypto.randomUUID().slice(0, 8)}`;
}

/**
 * Creates a business owned by `owner` through the same database function the app uses, signed
 * in as that owner (so RLS and the function's own checks apply).
 */
export async function createBusinessFor(
  owner: { email: string; password: string },
  name: string,
  options: { timezone?: string; language?: "en" | "ar" } = {},
) {
  const { url, publishableKey } = supabaseSettings();
  const client = createClient(url, publishableKey, {
    auth: { persistSession: false },
  });
  const { error: signInError } = await client.auth.signInWithPassword(owner);
  if (signInError) throw signInError;

  const slug = slugify(name);
  const { data: id, error } = await client.rpc("create_business", {
    business_name: name,
    business_slug: slug,
    business_timezone: options.timezone ?? "Africa/Cairo",
    business_language: options.language ?? "en",
  });
  if (error) throw error;
  return { id: id as string, name, slug };
}

/** Adds an existing user to a business as admin or staff (what an owner or admin can do). */
export async function addMember(
  businessId: string,
  email: string,
  role: "admin" | "staff",
) {
  const admin = adminClient();
  const { data: profile, error: profileError } = await admin
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single();
  if (profileError) throw profileError;
  const { error } = await admin
    .from("business_members")
    .insert({ business_id: businessId, user_id: profile.id, role });
  if (error) throw error;
}

/** Adds a service straight to the database (service role), for tests that only need one listed. */
export async function addService(
  businessId: string,
  service: {
    nameEn?: string;
    nameAr?: string;
    duration?: number;
    price?: number;
    currency?: string;
  },
) {
  const { data, error } = await adminClient()
    .from("services")
    .insert({
      business_id: businessId,
      name_en: service.nameEn ?? null,
      name_ar: service.nameAr ?? null,
      duration_minutes: service.duration ?? 30,
      price: service.price ?? 10000,
      currency: service.currency ?? "EGP",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id as string;
}

/** Adds a staff member, and the services they perform, straight to the database (service role). */
export async function addStaffMember(
  businessId: string,
  name: string,
  serviceIds: string[] = [],
) {
  const admin = adminClient();
  const { data, error } = await admin
    .from("staff")
    .insert({ business_id: businessId, name })
    .select("id")
    .single();
  if (error) throw error;
  if (serviceIds.length > 0) {
    const { error: servicesError } = await admin.from("staff_services").insert(
      serviceIds.map((serviceId) => ({
        business_id: businessId,
        staff_id: data.id,
        service_id: serviceId,
      })),
    );
    if (servicesError) throw servicesError;
  }
  return data.id as string;
}

/** Archives a service, as an owner can. */
export async function archiveService(serviceId: string) {
  const { error } = await adminClient()
    .from("services")
    .update({ active: false })
    .eq("id", serviceId);
  if (error) throw error;
}

/** Sets a weekly schedule straight in the database (service role): the business's when `staffId` is null. */
export async function setHoursFor(
  businessId: string,
  staffId: string | null,
  spans: { weekday: number; opens_at: string; closes_at: string }[],
) {
  const { error } = await adminClient()
    .from("working_hours")
    .insert(
      spans.map((span) => ({
        business_id: businessId,
        staff_id: staffId,
        ...span,
      })),
    );
  if (error) throw error;
}

/**
 * Books a service through the booking function as server code (the path the assistant will
 * use), so all the booking rules apply. Returns the booking's id.
 */
export async function addBooking(
  serviceId: string,
  startsAt: string,
  options: { staffId?: string; customerName?: string; phone?: string } = {},
) {
  const { data, error } = await adminClient().rpc("book_appointment", {
    target_service_id: serviceId,
    requested_start: startsAt,
    customer_name: options.customerName ?? "Mona Adel",
    customer_phone: options.phone ?? "+966501234567",
    idempotency_key: crypto.randomUUID(),
    target_staff_id: options.staffId,
  });
  if (error) throw error;
  return data.id as string;
}
