import { Suspense } from "react";
import { ReadOnlyBanner } from "@/app/(app)/read-only-banner";
import { isReadOnly } from "@/lib/auth";
import { createServerComponentClient } from "@/lib/supabase/server";

/** For a read-only account (the public demo), a note on every signed-in page. */
export async function ReadOnlyNotice() {
  const supabase = await createServerComponentClient();
  const { data } = await supabase.auth.getClaims();
  if (!data || !isReadOnly(data.claims)) return null;
  return (
    <Suspense fallback={null}>
      <ReadOnlyBanner />
    </Suspense>
  );
}
