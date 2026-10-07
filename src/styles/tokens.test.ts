import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  contrast,
  readTokenBlocks,
  tokensCssPath,
  tokensJson,
  tokensJsonPath,
} from "../../scripts/design-tokens.mjs";

// The design tokens (src/styles/tokens.css) stay consistent with themselves, with the exported
// JSON, and with WCAG AA: changing a color that breaks a pair fails here.

const css = readFileSync(tokensCssPath, "utf8");
const { light, darkMedia, darkClass } = readTokenBlocks(css);

/** Text and outline pairs the interface uses, with the contrast each needs. */
const pairs: [foreground: string, background: string, needs: number][] = [
  ["ink", "bg", 4.5],
  ["ink", "surface", 4.5],
  ["ink", "surface-2", 4.5],
  ["ink-2", "bg", 4.5],
  ["ink-2", "surface", 4.5],
  ["ink-2", "surface-2", 4.5],
  ["ink-3", "bg", 4.5],
  ["ink-3", "surface", 4.5],
  ["ink-3", "surface-2", 4.5],
  ["on-accent", "accent", 4.5],
  ["on-accent", "accent-strong", 4.5],
  ["accent", "bg", 4.5],
  ["accent", "surface", 4.5],
  ["accent-ink", "accent-soft", 4.5],
  ["success", "success-soft", 4.5],
  ["success", "surface", 4.5],
  ["warning-ink", "warning-soft", 4.5],
  ["warning-ink", "bg", 4.5],
  ["danger", "danger-soft", 4.5],
  ["danger", "surface", 4.5],
  ["danger", "bg", 4.5],
  ["on-danger", "danger", 4.5],
  // Field outlines and the focus ring are user interface parts: 3:1.
  ["line-input", "surface", 3],
  ["line-input", "bg", 3],
];

describe("design tokens", () => {
  it("writes the same dark values for the device setting and for .hala-dark", () => {
    expect(darkClass).toEqual(darkMedia);
  });

  it("gives every light color and shadow a dark value", () => {
    expect(Object.keys(darkMedia).sort()).toEqual(Object.keys(light).sort());
  });

  it("are exported to docs/design/tokens.json (run `pnpm tokens` after changing them)", () => {
    expect(JSON.parse(readFileSync(tokensJsonPath, "utf8"))).toEqual(
      tokensJson(css),
    );
  });

  describe.each([
    ["light", light],
    ["dark", darkMedia],
  ])("%s colors meet WCAG AA", (_mode, tokens) => {
    it.each(pairs)("%s on %s reaches %s:1", (foreground, background, needs) => {
      const [front, back] = [tokens[foreground], tokens[background]];
      if (!front || !back)
        throw new Error(`Missing ${foreground} or ${background}`);
      expect(contrast(front, back)).toBeGreaterThanOrEqual(needs);
    });
  });
});
