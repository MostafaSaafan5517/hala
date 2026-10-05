import { createServer } from "node:http";
import type { AddressInfo } from "node:net";

/**
 * A website carrying the widget's embed code (a business's own site, or someone else's), served
 * on its own loopback port: browsers won't let a public site load scripts from localhost, where
 * the app under test runs. Close it when the test ends.
 */
export async function siteWithWidget(options: {
  appUrl: string | undefined;
  slug: string;
  language?: "en" | "ar";
}) {
  const language = options.language
    ? ` data-language="${options.language}"`
    : "";
  const server = createServer((_request, response) => {
    response.writeHead(200, { "Content-Type": "text/html" });
    response.end(
      `<!doctype html><html lang="en"><title>Site</title><body><main>A site</main><script src="${options.appUrl}/widget.js" data-business="${options.slug}" data-label="Chat with us"${language} defer></script></body></html>`,
    );
  });
  await new Promise<void>((resolve) =>
    server.listen(0, "127.0.0.1", () => resolve()),
  );
  const { port } = server.address() as AddressInfo;
  return {
    origin: `http://127.0.0.1:${port}`,
    close: () => new Promise<void>((resolve) => server.close(() => resolve())),
  };
}
