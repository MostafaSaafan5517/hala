import { existsSync } from "node:fs";
import { defineConfig, devices } from "@playwright/test";

// Test helpers will call Supabase directly (for example to create a confirmed user), so they need
// the same local settings as the app. `pnpm env:local` writes them.
if (existsSync(".env.local")) process.loadEnvFile(".env.local");
// `next build` and `next start` read .env.production.local before .env.local, so with that file
// around the app under test would quietly talk to whatever it points at. Keep production
// settings under another name.
if (existsSync(".env.production.local")) {
  throw new Error(
    "Found .env.production.local: Next.js would use it instead of .env.local. Rename it first.",
  );
}

const isCI = Boolean(process.env.CI);
// Port 3100, like `pnpm dev`: another local project may be using 3000.
const baseURL = "http://localhost:3100";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: isCI,
  retries: isCI ? 2 : 0,
  reporter: isCI ? [["github"], ["html", { open: "never" }]] : "list",
  // Locally the dev server compiles each route on its first visit, which can take several
  // seconds while tests run in parallel. CI runs the production build and keeps Playwright's
  // defaults.
  timeout: isCI ? 30_000 : 60_000,
  expect: { timeout: isCI ? 5_000 : 15_000 },
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // CI tests the production build (`pnpm build` runs first); locally the dev server is enough.
    command: isCI ? "pnpm start" : "pnpm dev",
    url: baseURL,
    reuseExistingServer: !isCI,
  },
});
