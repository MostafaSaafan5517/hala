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
