import { defineConfig } from "vitest/config";

// Concurrency tests against the local database (`pnpm supabase start` or `db start` first).
// Separate from the unit tests, which need nothing running.
export default defineConfig({
  test: {
    include: ["supabase/tests/concurrency/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
