/** Most sites a widget may be allowed on (the database's limit). */
const MAX_ORIGINS = 10;

/**
 * The origins in what an owner typed, one site per line ("https://nour-salon.com", or with a
 * trailing slash): scheme, host and port, lowercase, as browsers send them. A line with a path
 * is refused rather than trimmed, so nobody believes a page is allowed when it's the whole site.
 */
export function parseOrigins(text: string): string[] | { error: string } {
  const origins = new Set<string>();
  for (const line of text.split(/\r?\n/).map((entry) => entry.trim())) {
    if (!line) continue;
    let url: URL;
    try {
      url = new URL(line);
    } catch {
      return {
        error: `"${line}" isn't a web address. Use https://your-site.com.`,
      };
    }
    if (
      (url.protocol !== "https:" && url.protocol !== "http:") ||
      url.pathname !== "/" ||
      url.search ||
      url.hash ||
      url.username
    ) {
      return {
        error: `Enter just the site for "${line}", like https://your-site.com, without a page or path.`,
      };
    }
    origins.add(url.origin);
  }
  if (origins.size > MAX_ORIGINS) {
    return { error: `Allow at most ${MAX_ORIGINS} sites.` };
  }
  return [...origins];
}
