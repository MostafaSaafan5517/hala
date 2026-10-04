// Writes the local Supabase URL and keys into .env.local.
// Usage (via `pnpm env:local`): supabase status -o json | node scripts/write-local-env.mjs
// Only those lines are written; anything else in .env.local (AI keys, ...) is kept.
import { existsSync, readFileSync, writeFileSync } from "node:fs";

const ENV_FILE = ".env.local";

const input = readFileSync(0, "utf8");
const jsonStart = input.indexOf("{");
if (jsonStart === -1) {
  throw new Error(
    "No JSON on stdin. Is local Supabase running? Try `pnpm supabase start`.",
  );
}
const status = JSON.parse(input.slice(jsonStart));

const values = {
  NEXT_PUBLIC_SUPABASE_URL: status.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: status.PUBLISHABLE_KEY,
  SUPABASE_SECRET_KEY: status.SECRET_KEY,
};
const missing = Object.entries(values)
  .filter(([, value]) => !value)
  .map(([name]) => name);
if (missing.length > 0) {
  throw new Error(
    `supabase status did not report ${missing.join(", ")}. Start the full stack with ` +
      "`pnpm supabase start` (not `db start`).",
  );
}

const nameOf = (line) => line.split("=")[0]?.trim();
const keptLines = (
  existsSync(ENV_FILE) ? readFileSync(ENV_FILE, "utf8").split(/\r?\n/) : []
).filter((line) => !(nameOf(line) in values));
while (keptLines.length > 0 && keptLines.at(-1) === "") keptLines.pop();
const newLines = Object.entries(values).map(
  ([name, value]) => `${name}=${value}`,
);
writeFileSync(ENV_FILE, [...keptLines, ...newLines, ""].join("\n"));
process.stdout.write(
  `Wrote ${Object.keys(values).join(", ")} to ${ENV_FILE}\n`,
);
