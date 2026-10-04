import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// Integration tests: app code against the full local Supabase stack (`pnpm supabase start`),
// with the offline models. They read the same .env.local as the app (`pnpm env:local`).
process.loadEnvFile(".env.local");

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    // Server-only modules are what's under test here; outside Next.js the marker would throw.
    alias: {
      "server-only": fileURLToPath(
        new URL("node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    include: ["integration/**/*.test.ts"],
    testTimeout: 30_000,
  },
});
