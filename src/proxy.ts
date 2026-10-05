import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseConfig } from "@/lib/supabase/config";
import { frameAncestors, widgetFramePolicy } from "@/lib/widget/frame-policy";

// Runs before every page and Server Action. Its main job is keeping the Supabase session fresh:
// Server Components can't set cookies, so an expired access token has to be refreshed here,
// before rendering starts. Authorization is not decided here; every page and action checks
// the user itself, and RLS checks again in the database.
//
// The website widget is the exception: its visitors have no session, and its page carries the
// business's own frame-ancestors policy, which only a response header can set.
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const widget = /^\/widget\/([^/]+)\/?$/.exec(pathname);
  if (widget) {
    const response = NextResponse.next();
    response.headers.set(
      "Content-Security-Policy",
      await widgetFramePolicy(decodeURIComponent(widget[1]!)).catch((error) => {
        // Failing closed: only Hala's own pages may frame it until the lookup works again.
        console.error("Loading a widget's frame policy failed", {
          name: error instanceof Error ? error.name : "UnknownError",
        });
        return frameAncestors([]);
      }),
    );
    return response;
  }
  if (pathname.startsWith("/api/widget/")) return NextResponse.next();

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    supabaseConfig.url,
    supabaseConfig.publishableKey,
    {
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet, headers) {
          // Update the request too, so Server Components in this same request see the
          // refreshed session, then rebuild the response to carry it to the browser.
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // no-store headers: a CDN must never cache a response that sets someone's session.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Validates the access token and refreshes it if it has expired.
  await supabase.auth.getClaims();

  return response;
}

export const config = {
  // Skip static files and images; they don't carry a user session.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
