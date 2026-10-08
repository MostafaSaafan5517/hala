// Reads Hala's design tokens from src/styles/tokens.css and, run directly (`pnpm tokens`),
// writes docs/design/tokens.json for projects and tools that don't read CSS. The unit test
// (src/styles/tokens.test.ts) imports the same functions to keep the JSON in step with the CSS
// and to check the colors still meet WCAG AA.

import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const root = new URL("..", import.meta.url);
export const tokensCssPath = fileURLToPath(
  new URL("src/styles/tokens.css", root),
);
export const tokensJsonPath = fileURLToPath(
  new URL("docs/design/tokens.json", root),
);

/**
 * The custom properties declared directly inside the first block whose selector matches.
 * @param {string} css
 * @param {RegExp} selectorPattern
 * @returns {Record<string, string>}
 */
function declarationsOf(css, selectorPattern) {
  const match = css.match(selectorPattern);
  if (!match) throw new Error(`No block matching ${selectorPattern}`);
  const start = css.indexOf("{", match.index) + 1;
  let depth = 1;
  let end = start;
  while (depth > 0) {
    if (css[end] === "{") depth += 1;
    if (css[end] === "}") depth -= 1;
    end += 1;
  }
  const body = css.slice(start, end - 1).replace(/\/\*[\s\S]*?\*\//g, "");
  /** @type {Record<string, string>} */
  const declarations = {};
  for (const [, name, value] of body.matchAll(
    /--hala-([\w-]+)\s*:\s*([^;]+);/g,
  )) {
    declarations[name] = value.replace(/\s+/g, " ").trim();
  }
  return declarations;
}

/**
 * The light, dark (media query and .hala-dark) and mode-independent declarations.
 * @param {string} css
 */
export function readTokenBlocks(css) {
  const mediaStart = css.search(/@media \(prefers-color-scheme: dark\)/);
  return {
    light: declarationsOf(css, /:root,\s*\.hala-light\s*\{/),
    darkMedia: declarationsOf(css.slice(mediaStart), /:root\s*\{/),
    darkClass: declarationsOf(css, /\n\.hala-dark\s*\{/),
    shared: declarationsOf(
      css,
      /\/\* Everything that doesn't change with the mode\. \*\/\s*:root\s*\{/,
    ),
  };
}

/**
 * OKLCH ("l c h" or "l c h / a") to linear and gamma-encoded sRGB, clamped to the gamut.
 * @param {string} value
 */
export function oklchToRgb(value) {
  const [l, c, h] = value
    .replace(/^oklch\(|\)$/g, "")
    .split("/")[0]
    .trim()
    .split(/\s+/)
    .map(Number);
  const a = c * Math.cos((h * Math.PI) / 180);
  const b = c * Math.sin((h * Math.PI) / 180);
  const l_ = (l + 0.3963377774 * a + 0.2158037573 * b) ** 3;
  const m_ = (l - 0.1055613458 * a - 0.0638541728 * b) ** 3;
  const s_ = (l - 0.0894841775 * a - 1.291485548 * b) ** 3;
  const linear = [
    4.0767416621 * l_ - 3.3077115913 * m_ + 0.2309699292 * s_,
    -1.2684380046 * l_ + 2.6097574011 * m_ - 0.3413193965 * s_,
    -0.0041960863 * l_ - 0.7034186147 * m_ + 1.707614701 * s_,
  ].map((channel) => Math.min(1, Math.max(0, channel)));
  const encoded = linear.map((channel) =>
    channel <= 0.0031308
      ? 12.92 * channel
      : 1.055 * channel ** (1 / 2.4) - 0.055,
  );
  return { linear, encoded };
}

/** @param {string} value */
export function oklchToHex(value) {
  return `#${oklchToRgb(value)
    .encoded.map((channel) =>
      Math.round(channel * 255)
        .toString(16)
        .padStart(2, "0"),
    )
    .join("")}`;
}

/**
 * WCAG 2 contrast ratio between two opaque OKLCH colors.
 * @param {string} first
 * @param {string} second
 */
export function contrast(first, second) {
  /** @param {string} value */
  const luminance = (value) => {
    const [r, g, b] = oklchToRgb(value).linear;
    return 0.2126 * r + 0.7152 * g + 0.0722 * b;
  };
  const [lighter, darker] = [luminance(first), luminance(second)].sort(
    (x, y) => y - x,
  );
  return (lighter + 0.05) / (darker + 0.05);
}

/** @param {string} value */
const isColor = (value) => value.startsWith("oklch(");

/**
 * tokens.json: colors and shadows per mode (OKLCH plus a hex fallback), then the rest.
 * @param {string} css
 */
export function tokensJson(css) {
  const { light, darkMedia, shared } = readTokenBlocks(css);
  /** @type {Record<string, { light: { oklch: string, hex: string }, dark: { oklch: string, hex: string } }>} */
  const color = {};
  /** @type {Record<string, { light: string, dark: string }>} */
  const shadow = {};
  for (const [name, value] of Object.entries(light)) {
    if (isColor(value)) {
      color[name] = {
        light: { oklch: value, hex: oklchToHex(value) },
        dark: { oklch: darkMedia[name], hex: oklchToHex(darkMedia[name]) },
      };
    } else {
      shadow[name.replace(/^shadow-/, "")] = {
        light: value,
        dark: darkMedia[name],
      };
    }
  }
  /** @param {string} prefix */
  const pick = (prefix) =>
    Object.fromEntries(
      Object.entries(shared)
        .filter(([name]) => name.startsWith(prefix))
        .map(([name, value]) => [name.slice(prefix.length), value]),
    );
  /** @type {Record<string, string>} */
  const textKeys = {
    size: "size",
    "line-height": "lineHeight",
    "line-height-arabic": "lineHeightArabic",
    weight: "fontWeight",
    tracking: "letterSpacing",
  };
  /** @type {Record<string, Record<string, string>>} */
  const text = {};
  for (const [name, value] of Object.entries(pick("text-"))) {
    const [step = "", ...rest] = name.split("-");
    const key = textKeys[rest.length === 0 ? "size" : rest.join("-")];
    if (!key) throw new Error(`Unknown text token --hala-text-${name}`);
    text[step] ??= {};
    text[step][key] = value;
  }
  return {
    $description:
      "Hala's design tokens, exported from src/styles/tokens.css by `pnpm tokens`. See docs/design/TOKENS.md.",
    color,
    shadow,
    radius: pick("radius-"),
    font: {
      sans: "Readex Pro (Latin and Arabic), weights 160 to 700",
      mono: "Geist Mono",
    },
    text,
    motion: {
      ease: shared.ease,
      durationFast: shared["duration-fast"],
      duration: shared.duration,
      durationSlow: shared["duration-slow"],
    },
  };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const json = tokensJson(readFileSync(tokensCssPath, "utf8"));
  writeFileSync(tokensJsonPath, `${JSON.stringify(json, null, 2)}\n`);
  console.log(`Wrote ${tokensJsonPath}`);
}
