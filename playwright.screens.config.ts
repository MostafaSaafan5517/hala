import { defineConfig, devices } from "@playwright/test";
import base from "./playwright.config";

// Screenshots of every screen and state, for the design audit and its before/after comparison:
// `pnpm build`, then `SCREENS_DIR=docs/design/before pnpm screens`. Like CI, it serves the
// production build with the offline models (playwright.config.ts sets them), so two runs show
// the same states in the same words. Not a test suite: it records what it sees, and axe's
// findings, without judging them.
export default defineConfig({
  ...base,
  testDir: "./scripts/screens",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: "list",
  timeout: 360_000,
  expect: { timeout: 15_000 },
  // A wrong selector fails in seconds instead of using up the whole test.
  use: { ...base.use, trace: "off", actionTimeout: 30_000 },
  projects: [
    {
      name: "desktop",
      use: {
        ...devices["Desktop Chrome"],
        viewport: { width: 1440, height: 900 },
      },
    },
    {
      name: "mobile",
      // After desktop: each pass starts by resetting the demo it then changes.
      dependencies: ["desktop"],
      use: {
        ...devices["Pixel 7"],
        viewport: { width: 390, height: 844 },
        deviceScaleFactor: 1,
      },
    },
  ],
  webServer: {
    command: "pnpm start",
    url: "http://localhost:3100",
    reuseExistingServer: false,
  },
});
