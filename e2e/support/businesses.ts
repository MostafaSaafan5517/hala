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
