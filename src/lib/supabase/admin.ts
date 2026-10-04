import "server-only";
import { createClient } from "@supabase/supabase-js";
import { supabaseConfig } from "@/lib/supabase/config";
import type { Database } from "@/lib/supabase/database.types";

/**
 * A service-role client for what server code must write and users must not: the model usage
 * log. It bypasses Row-Level Security, so never use it to read or write on a user's behalf;
 * that goes through the user's own client.
 */
export function createAdminClient() {
  const secretKey = process.env.SUPABASE_SECRET_KEY;
  if (!secretKey) {
    throw new Error(
      "SUPABASE_SECRET_KEY is not set. Run `pnpm env:local`, or fill .env.local from .env.example.",
    );
  }
  return createClient<Database>(supabaseConfig.url, secretKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
