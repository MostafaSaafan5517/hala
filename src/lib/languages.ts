import type { Enums } from "@/lib/supabase/database.types";

export type Language = Enums<"language">;

/** Each language the assistant speaks, named in that language. */
export const languageNames: Record<Language, string> = {
  en: "English",
  ar: "العربية",
};
