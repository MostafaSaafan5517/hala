@AGENTS.md

# Hala: project guide

An AI receptionist for appointment-based businesses (salons, clinics, studios, consultants), in Arabic and English. A business sets up its services, staff, working hours, booking rules, FAQs and policies; customers chat with the assistant through an embeddable website widget, which answers questions from the business's own data, checks real availability, and books, reschedules or cancels appointments. Staff see conversations and bookings and can take a conversation over.

This is a public portfolio project. Test coverage, clear decisions, and a clean commit history matter as much as features. Every part must be explainable in a client interview, especially retrieval, tool calling, grounding and the double-booking constraint.

The product name is a working name. In code it lives only in `src/config/app.ts`; never hard-code it anywhere else in `src/`. The docs (`README.md`, this file) use it by name.

## Stack

- Next.js 16 (App Router), TypeScript in strict mode plus `noUncheckedIndexedAccess`
- Tailwind CSS v4 + shadcn/ui (Base UI, `base-nova` style, RTL enabled)
- Supabase: Postgres, Auth, Row-Level Security, pgvector. Local development with the Supabase CLI and SQL migrations
- LLM access through a provider-agnostic layer (planned: the Vercel AI SDK), Anthropic Claude by default and switchable to OpenAI by configuration; Zod validates every tool input and structured model output
- Vitest (unit), Playwright (end-to-end, with axe accessibility checks), pgTAP via `supabase test db` (database and RLS)
- GitHub Actions CI; Vercel hosting
- pnpm; Node 24. `engines.node` in `package.json` is the single source of truth for the Node version (Vercel and CI both read it)

## Non-negotiable rules

1. **Tenant isolation lives in the database.** Every table has RLS, the vector store included: retrieval is always filtered by business. pgTAP tests prove one business can never read another's documents, services, customers or bookings, with negative tests for every policy.
2. **The model never writes data.** It can only request actions. Every action is a server-side tool that validates its input with Zod, re-checks permissions and business rules, and runs inside a database transaction.
3. **No double bookings, ever.** Postgres enforces it with an exclusion constraint on staff and time range (`btree_gist` + `tstzrange`) for active bookings, not just application code. A test fires two simultaneous bookings for the same slot and proves only one succeeds.
4. **A booking is confirmed only after the tool returns success.** The assistant never says "you're booked" from its own reasoning.
5. **Actions are idempotent.** Booking, rescheduling and cancelling take an idempotency key, so a retried or duplicated tool call can't act twice.
6. **Answers are grounded.** Facts come from retrieved business data or tool results, and the source is shown. When nothing relevant is retrieved, the assistant says it doesn't know and offers a human.
7. **Prompt injection changes nothing.** Business documents and customer messages are data, never instructions. Prices, rules and other customers' bookings are enforced by the tools on the server, so no message can change them.
8. **Cost and abuse are controlled.** Every model call logs tokens, cost and latency; businesses have rate limits and conversations have token budgets; the public demo has strict per-visitor limits.
9. **Every tool call is audited** (input, result, who or what triggered it) in an append-only log, written so that no role can edit or delete it.
10. **No secrets in the repo.** Real values go in `.env.local` (gitignored). Keep `.env.example` up to date.
11. **Small, reviewable steps.** Each meaningful step is its own commit with a Conventional Commits message (`feat:`, `fix:`, `refactor:`, `test:`, `docs:`, `ci:`, `chore:`). Verify (format, lint, typecheck, tests) before committing, then summarize what changed.
12. **Explain non-obvious decisions** briefly, in the step summary or in a code comment when the "why" is not obvious from the code.

## Code conventions

- Prettier formats everything (Tailwind classes are sorted automatically). ESLint must pass with zero warnings.
- Import app code through the `@/` alias, which maps to `src/`.
- UI primitives come from shadcn/ui. Add one with `pnpm dlx shadcn@latest add <name>`; it is copied into `src/components/ui/` and becomes our code to edit. Merge class names with `cn` (`@/lib/utils`).
- Layouts must work right-to-left for Arabic: use logical classes (`ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `text-start`), never `left`/`right` ones. shadcn generates logical classes because `rtl` is on in `components.json`.
- Anything that navigates is a `<Link>`, even when it looks like a button: style it with `buttonVariants()`, which merges its classes like `<Button>` does. Never `<Button render={<Link />}>`, which gives the link `role="button"`.
- Use theme tokens (`bg-background`, `text-muted-foreground`, `border-border`, ...) instead of raw colors, so the palette can change in one place (`src/app/globals.css`).
- Money is always an integer in the currency's smallest unit. Convert only for display.
- No `console.log` in app code, no commented-out code, no unused code. Unexpected server-side failures are logged with `console.error("What failed", { code, status })`; users get a plain message, never raw provider errors. Handle errors explicitly; no empty `catch` blocks.
- No abstractions for single-use code.

## Database conventions

- Every schema change is a SQL migration (`pnpm supabase migration new <name>`), never a click in Studio. `pnpm supabase db reset` must rebuild the whole database from the migrations alone. When `migration new` runs without a terminal (scripts, agents), it copies stdin into the new file and waits for it to close: pass `< /dev/null`.
- After changing the schema, run `pnpm db:types` and commit `src/lib/supabase/database.types.ts`. CI regenerates it and fails if it differs from the migrations.
- **Deny by default, in two layers.** The first migration removes Supabase's default privileges: API roles (`anon`, `authenticated`) get nothing on new tables, sequences and functions in `public`, and no new function is executable by anyone, until a migration grants it. So every new table needs grants (which operations, and which columns, an API role may attempt) and RLS policies (which rows). `service_role` keeps its access; only server code uses it.
- Helper functions that RLS policies call live in the `private` schema, which the API never serves. A policy must not query another RLS-protected table whose policy could query back: ask through a `private` security-definer helper instead.
- Extensions live in the `extensions` schema (pgvector is there: `extensions.vector`).
- Policy names are short sentences of at most 62 characters: Postgres silently cuts identifiers at 63 bytes.

## Testing conventions

- Unit tests sit next to the code they test as `*.test.ts`; Vitest only looks inside `src/`. End-to-end specs live in `e2e/` and only Playwright runs them.
- pgTAP tests live in `supabase/tests/database/*.test.sql`. Each file runs in a transaction and rolls back. `000_setup.test.sql` runs first and defines helpers in a `tests` schema that only exists in test databases: `tests.create_user(email)`, `tests.authenticate_as(email)` (the API's `authenticated` role with `auth.uid()` set), `tests.authenticate_as_anon()`, `tests.authenticate_as_service_role()`, and `tests.act_as_database()` to go back to the database role with no claims left over.
- RLS denies silently on SELECT/UPDATE/DELETE (the rows just aren't there) but raises on INSERT and on missing grants. Test both kinds: check state after a refused update, and use `throws_ok` with the exact message for refused inserts. Prefer whole-row assertions (`results_eq`) over single values.
- A test must be able to fail. When adding one, break the rule once (drop the constraint, re-grant, change the code) and confirm the test goes red.
- Every page gets an accessibility check: `accessibilityViolations(page)` (`e2e/support/accessibility.ts`) runs axe's WCAG 2.1 A and AA rules and must return `[]`.
- Tests never call a real model: tools and the chat route are tested with a mocked model. Only the evaluation suite (Phase 6), run on demand, uses the real one, and logs what it cost.

## Folder structure

```
src/
  app/               Next.js App Router routes and layouts
  components/ui/     shadcn/ui components (owned code, edited freely)
  config/            App-wide constants (the product name lives here)
  lib/               Helpers
  lib/supabase/      Supabase clients and generated database types
scripts/             Dev tooling (writing .env.local)
e2e/                 Playwright end-to-end specs (*.spec.ts)
  support/           E2E helpers (accessibility checks, ...)
supabase/
  config.toml        Local Supabase settings (ports 553xx; unused services off)
  migrations/        SQL migrations, applied in filename order
  tests/database/    pgTAP tests for schema, privileges and RLS
.github/
  workflows/ci.yml   CI pipeline
  actions/setup/     Shared CI setup (pnpm, Node, dependencies)
```

## Commands

| Command                             | What it does                                            |
| ----------------------------------- | ------------------------------------------------------- |
| `pnpm dev`                          | Dev server at http://localhost:3100                     |
| `pnpm build` / `pnpm start`         | Production build / serve that build (port 3100)         |
| `pnpm lint`                         | ESLint; fails on any warning                            |
| `pnpm typecheck`                    | Generates Next.js route types, then runs `tsc`          |
| `pnpm format` / `pnpm format:check` | Prettier: rewrite files / check only (CI uses check)    |
| `pnpm test` / `pnpm test:watch`     | Vitest unit tests: single run / watch mode              |
| `pnpm test:e2e`                     | Playwright; starts `pnpm dev` itself if not running     |
| `pnpm test:db`                      | pgTAP database tests (Supabase must be running)         |
| `pnpm supabase start` / `stop`      | Start / stop local Supabase (needs Docker running)      |
| `pnpm env:local`                    | Write the local Supabase URL and keys into `.env.local` |
| `pnpm supabase db reset`            | Rebuild the local database from migrations              |
| `pnpm db:types`                     | Regenerate TypeScript types from the local database     |

First Playwright run on a machine: `pnpm exec playwright install chromium`. With `CI=1`, Playwright serves the production build (`pnpm build` first) instead of the dev server, exactly like CI.

## CI

GitHub Actions runs on every push to `main` and every pull request, as three parallel jobs:

- **checks**: `format:check`, `lint`, `typecheck`, `test`
- **database**: starts only Postgres (`pnpm supabase db start`, which applies every migration from scratch), runs `test:db`, then checks the generated types are current
- **e2e**: starts local Supabase (without Studio), writes `.env.local`, builds for production, then runs Playwright

Every CI step is a `pnpm` script, so anything that fails in CI can be reproduced locally with the same command. Keep it that way.

## Local setup notes

- Local Supabase needs Docker Desktop running (on Windows with the WSL 2 backend). The Supabase CLI is a pinned dev dependency, so always call it through `pnpm supabase`, never a global install.
- The local stack uses ports 553xx (API 55321, database 55322, Studio 55323, Mailpit 55324) and the app runs on 3100, so it can run next to another local Supabase project on the CLI's default 543xx ports and an app on 3000. Running both stacks at once needs a few GB of memory; stop the one you're not using (`pnpm supabase stop` keeps its data).
