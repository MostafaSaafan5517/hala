import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  buildWidget,
  widgetByteLimit,
  widgetPath,
  widgetSourcePath,
} from "../../scripts/build-widget.mjs";

// The embed script sites load (public/widget.js) is the minified source, and stays small: it
// loads on every page of every business's site.

describe("the widget's embed script", () => {
  it("is built from its source (run `pnpm widget` after changing it)", async () => {
    expect(readFileSync(widgetPath, "utf8")).toBe(
      await buildWidget(readFileSync(widgetSourcePath, "utf8")),
    );
  });

  it(`stays within ${widgetByteLimit} bytes`, () => {
    expect(readFileSync(widgetPath).length).toBeLessThanOrEqual(
      widgetByteLimit,
    );
  });
});
