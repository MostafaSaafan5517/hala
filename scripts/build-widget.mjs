// Minifies the website widget's embed script (src/embed/widget.js) to public/widget.js, the file
// businesses' sites load. Run directly (`pnpm widget`) after changing the source; the unit test
// (src/embed/widget.test.ts) imports the same function to check the two are in step.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { minify } from "terser";

const root = new URL("..", import.meta.url);
export const widgetSourcePath = fileURLToPath(
  new URL("src/embed/widget.js", root),
);
export const widgetPath = fileURLToPath(new URL("public/widget.js", root));

/** At most 10% over the embed script before the redesign, 2,652 bytes (docs/design/audit.md). */
export const widgetByteLimit = 2917;

/**
 * The embed script as sites load it.
 * @param {string} source
 * @returns {Promise<string>}
 */
export async function buildWidget(source) {
  const { code } = await minify(source, {
    compress: { passes: 2 },
    format: { preamble: "/* Minified from src/embed/widget.js */" },
  });
  return `${code}\n`;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  writeFileSync(
    widgetPath,
    await buildWidget(readFileSync(widgetSourcePath, "utf8")),
  );
  console.log(`Wrote ${widgetPath}`);
}
