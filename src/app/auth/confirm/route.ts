import { redirect } from "next/navigation";
import type { NextRequest } from "next/server";
import { SIGNED_IN_HOME } from "@/lib/auth";
import { safeRedirectPath } from "@/lib/safe-redirect";
import { createServerActionClient } from "@/lib/supabase/server";

// Where a confirmation email brings the user back to: sign-up asks for /auth/confirm?next=<the
// page to go on to>, and both kinds of email link here.
// - Our template (supabase/templates) adds a one-time token hash, which works in any browser:
//   tapping the link on a phone signs the phone in.
// - Supabase's default email, sent by projects that can't use custom templates (its free plan),
//   confirms the address on Supabase first and comes back with a one-time code. The code signs
//   in only the browser that signed up, which holds its PKCE verifier; anywhere else the address
//   is confirmed all the same, so the user is asked to sign in.
// A used or expired link comes back from Supabase with error parameters instead.
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const next = safeRedirectPath(searchParams.get("next"), SIGNED_IN_HOME);
  const tokenHash = searchParams.get("token_hash");
  const code = searchParams.get("code");

  // Our template only sends type=email; anything else is not a link we issued.
  if (tokenHash && searchParams.get("type") === "email") {
    const supabase = await createServerActionClient();
    const { error } = await supabase.auth.verifyOtp({
      type: "email",
      token_hash: tokenHash,
    });
    if (!error) redirect(next);
  } else if (code) {
    const supabase = await createServerActionClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) redirect(next);
    if (error.code !== "pkce_code_verifier_not_found") {
      console.error("Exchanging an email link's code failed", {
        code: error.code,
        status: error.status,
      });
    }
    redirect(`/login?${new URLSearchParams({ confirmed: "1", next })}`);
  }

  redirect("/login?error=link");
}
