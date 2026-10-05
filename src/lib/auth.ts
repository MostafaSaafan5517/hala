import { redirect } from "next/navigation";
import { createServerComponentClient } from "@/lib/supabase/server";

/** Where signing in leads when no page asked to have the user back: the user's businesses. */
export const SIGNED_IN_HOME = "/dashboard";

/**
 * For pages that need a signed-in user. Returns a Supabase client acting as that user, their
 * id and their token's claims; visitors are sent to sign in and brought back to `currentPath`
 * afterwards.
 */
export async function requireUser(currentPath: string) {
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getClaims();
  if (!data) redirect(`/login?next=${encodeURIComponent(currentPath)}`);
  return { supabase, userId: data.claims.sub, claims: data.claims };
}

/**
 * Whether the account is read-only, like the public demo's: its app_metadata says so (only the
 * admin API can set that), and the database refuses its changes whatever the app does.
 */
export function isReadOnly(claims: { app_metadata?: unknown }) {
  return (
    (claims.app_metadata as { read_only?: unknown } | undefined)?.read_only ===
    true
  );
}

/** Sends a read-only account back to the page it tried to change, which then says why. */
export function refuseReadOnly(path: string): never {
  redirect(`${path}${path.includes("?") ? "&" : "?"}read-only=1`);
}
