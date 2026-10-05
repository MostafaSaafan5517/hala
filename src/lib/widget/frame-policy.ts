// Which sites may show a business's widget in a frame: the Content-Security-Policy
// frame-ancestors directive, from the origins the business allowed. Browsers enforce it, so the
// widget can't be put on someone else's site (to pose as the business, or to trick its visitors
// into clicking). Hala's own pages ('self') may show it too: the dashboard previews it. Used by
// the proxy, so no server-only imports.

/** The frame-ancestors policy for a widget allowed on these origins. */
export function frameAncestors(origins: string[]) {
  return ["frame-ancestors 'self'", ...origins].join(" ");
}

/**
 * The policy for a widget slug: its business's allowed origins when the widget is on, only
 * Hala's own pages otherwise. Read straight from the API with the secret key (the proxy can't
 * use the app's server-only clients). Not cached: a site the owner just allowed works at once,
 * and the widget's page loads the business anyway.
 */
export async function widgetFramePolicy(slug: string) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error("Missing Supabase settings for the proxy.");
  const response = await fetch(
    `${url}/rest/v1/businesses?slug=eq.${encodeURIComponent(slug)}&select=widget_enabled,widget_origins`,
    { headers: { apikey: key, Authorization: `Bearer ${key}` } },
  );
  if (!response.ok) {
    throw new Error(`Could not load the widget's origins: ${response.status}`);
  }
  const [business] = (await response.json()) as {
    widget_enabled: boolean;
    widget_origins: string[];
  }[];
  return frameAncestors(
    business?.widget_enabled ? business.widget_origins : [],
  );
}
