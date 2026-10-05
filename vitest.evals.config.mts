import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// The evaluation suite: scripted conversations against the real assistant and the full local
// Supabase stack, scored and written to evals/reports/. Run on demand (`pnpm eval`), never in CI:
// with real models it costs money (CHAT_MODEL, EMBEDDING_MODEL and AI_GATEWAY_API_KEY come from
// .env.local; a variable already set in the shell wins).
process.loadEnvFile(".env.local");

export default defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: {
      "server-only": fileURLToPath(
        new URL("node_modules/server-only/empty.js", import.meta.url),
      ),
    },
  },
  test: {
    include: ["evals/**/*.eval.ts"],
    testTimeout: 30 * 60_000,
    hookTimeout: 5 * 60_000,
  },
});
