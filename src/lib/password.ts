import { z } from "zod";

/**
 * The rules for a new password, mirroring the ones in supabase/config.toml, so users see the
 * reason before Supabase refuses it.
 */
export const newPasswordSchema = z
  .string()
  .regex(
    /^(?=.*[A-Za-z])(?=.*\d).{8,}$/,
    "Use at least 8 characters, with letters and numbers.",
  );
