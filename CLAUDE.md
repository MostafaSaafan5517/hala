@AGENTS.md

# Hala: project guide

An AI receptionist for appointment-based businesses (salons, clinics, studios, consultants), in Arabic and English. A business sets up its services, staff, working hours, booking rules, FAQs and policies; customers chat with the assistant through an embeddable website widget, which answers questions from the business's own data, checks real availability, and books, reschedules or cancels appointments. Staff see conversations and bookings and can take a conversation over.

This is a public portfolio project. Test coverage, clear decisions, and a clean commit history matter as much as features. Every part must be explainable in a client interview, especially retrieval, tool calling, grounding and the double-booking constraint.

The product name is a working name. In code it lives only in `src/config/app.ts`; never hard-code it anywhere else in `src/`. The docs (`README.md`, this file) use it by name.

## Stack

- Next.js 16 (App Router), TypeScript in strict mode plus `noUncheckedIndexedAccess`
- Tailwind CSS v4 + shadcn/ui (Base UI, `base-nova` style, RTL enabled)
- Supabase: Postgres, Auth, Row-Level Security, pgvector. Local development with the Supabase CLI and SQL migrations
- AI through the Vercel AI SDK (v7) and the Vercel AI Gateway: one key, models named `provider/model` and chosen in env, never in code. Embeddings: `openai/text-embedding-3-small` (or the `offline` stand-in). The chat model (Phase 4) will be Anthropic Claude by default, switchable to OpenAI by configuration. Zod validates every tool input and structured model output. The AI SDK changes often: read its bundled docs in `node_modules/ai/docs/` before using an API, never memory
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
- Money is always an integer in the currency's smallest unit. Convert only for display, with `src/lib/money.ts`: the number of decimals comes from the currency (`minorUnitDigits`: 2 for EGP, 3 for KWD, 0 for JPY), never a hard-coded 100, and `parseAmount` accepts Arabic-Indic digits and separators.
- Arabic text is always marked `lang="ar"` (plus `dir="rtl"` on blocks). The Arabic font is applied by a `:lang(ar)` rule in `globals.css`, because a font list alone falls back to Arial for Arabic. Text whose language we don't know (names, typed input) gets `dir="auto"`. `ServiceName` (`src/components/service-name.tsx`) shows a service's names this way.
- Times: moments are stored in UTC (`timestamptz`) and shown in the business's time zone with `formatLocalDateTime` (`src/lib/dates.ts`); never in the browser's or the server's zone. Weekly hours are local wall-clock times, and whole days (closures) are plain dates. Local times are converted to UTC in Postgres (`local at time zone businesses.timezone`), so daylight saving comes from the time zone database, not from our code.
- Forms are Server Actions validated with Zod. A failed validation returns the form's values and one plain message; success redirects or shows "Saved." in a `role="status"` region.
- No `console.log` in app code, no commented-out code, no unused code. Unexpected server-side failures are logged with `console.error("What failed", { code, status })`; users get a plain message, never raw provider errors. Handle errors explicitly; no empty `catch` blocks.
- No abstractions for single-use code.

## Database conventions

- Every schema change is a SQL migration (`pnpm supabase migration new <name>`), never a click in Studio. `pnpm supabase db reset` must rebuild the whole database from the migrations alone. When `migration new` runs without a terminal (scripts, agents), it copies stdin into the new file and waits for it to close: pass `< /dev/null`.
- After changing the schema, run `pnpm db:types` and commit `src/lib/supabase/database.types.ts`. CI regenerates it and fails if it differs from the migrations.
- **Deny by default, in two layers.** The first migration removes Supabase's default privileges: API roles (`anon`, `authenticated`) get nothing on new tables, sequences and functions in `public`, and no new function is executable by anyone, until a migration grants it. So every new table needs grants (which operations, and which columns, an API role may attempt) and RLS policies (which rows). `service_role` keeps its access; only server code uses it.
- Helper functions that RLS policies call live in the `private` schema, which the API never serves. A policy must not query another RLS-protected table whose policy could query back: ask through a `private` security-definer helper instead.
- Extensions live in the `extensions` schema (pgvector is there: `extensions.vector`).
- Policy names are short sentences of at most 62 characters: Postgres silently cuts identifiers at 63 bytes.
- Roles are checked with `private.has_business_role(business_id, '{owner,admin}')` (or `'{owner,admin,staff}'` for reading). Owners and admins manage a business's setup; staff only view it.
- Grant only the columns an API role may write (`grant insert (a, b)`, `grant update (c)`), so ids, `business_id` and timestamps can't be changed through the API even where RLS allows the row.
- Rows that point at another tenant row use a composite foreign key with `business_id` (for example `(staff_id, business_id) references staff (id, business_id)`), so a row can never link two businesses' data, whatever the policies say.
- A save that touches several rows (a staff member and their services, a week of hours) is one `security invoker` SQL function: it runs under the caller's RLS and in one transaction, so it either all happens or none of it does. Use `security definer` only when the caller must not have the underlying rights (as in `create_business`), and then check `auth.uid()` yourself.
- Things a past booking may point to (services, staff) are archived (`active = false`), not deleted: there is no delete grant on them.
- Every tenant table gets the audit trigger (`private.record_audit_log('<id column>')`), and is added to `tests.clear_tenant_data()` in `000_setup.test.sql`.
- Time zones are IANA names checked by `private.is_time_zone` (fixed offsets like `+02` are refused: they ignore daylight saving).

## Data model so far

- `profiles` (one per auth user, from a trigger), `businesses` (slug, time zone, the assistant's first language, booking rules) and `business_members` (owner, admin or staff; exactly one owner, enforced by a unique index and a trigger). `create_business` creates a business and its owner row together.
- `services` (English and/or Arabic name, duration and buffer in 5-minute steps, price in the smallest unit, currency), `staff` (bookable people, no account needed) and `staff_services` (who performs what).
- `working_hours`: weekly spans in local time, 0 = Sunday, closing at `24:00` allowed, no overlaps (an exclusion constraint). Rows with a null `staff_id` are the business's hours. A staff member with no rows of their own works the business's hours; one with any rows works exactly those. `set_working_hours` replaces a whole week at once.
- `time_off` (a staff member away, stored in UTC; `add_time_off` takes local times) and `closures` (whole days the business is shut, as plain dates, first and last day included).
- Booking rules on `businesses`: `booking_notice_minutes`, `booking_horizon_days`, `slot_interval_minutes` and `cancellation_notice_hours`.
- `customers`: per business, known by an E.164 phone number (unique per business), with an optional email and the language to answer them in. Created only by `book_appointment`; an existing customer's details aren't changed by booking.
- `bookings`: customer, service, staff member, `starts_at`/`ends_at`, `blocked_until` (end plus the service's buffer), status `confirmed` or `cancelled`, the price and currency at booking time, and a six-character `reference` (no look-alike characters). The `bookings_no_overlap` exclusion constraint refuses a confirmed booking whose `[starts_at, blocked_until)` overlaps another confirmed booking of the same staff member. Every booking has a staff member (a one-person business adds itself as staff).
- `private.idempotency_keys`: each key's business, request (action and arguments) and booking. Kept, so a replay months later still can't act twice.
- `audit_log`: append-only history of every change to the tables above, written only by triggers, with the actor (`user`, `server` for the service role, `database` for migrations and psql). Owners and admins can read their business's history.

## The booking engine

- **Availability** is one SQL function, `private.free_slots`, wrapped by `public.available_slots(service, from_date, to_date, staff?, ignored_booking?)` (at most 31 days per call). The slot pickers and the booking functions both use it, so what is offered and what is accepted can't disagree. A start is offered when it is on the interval grid counted from local midnight, the appointment fits a working span (the staff member's own hours, else the business's), the day isn't a closure, it is past the notice and within the horizon, and the appointment plus buffer avoids time off and confirmed bookings (theirs include their buffers). The buffer may run past closing. Days are converted to UTC one at a time, so each uses its own offset. `free_slots` takes the clock as a parameter (`now_at`), which is how pgTAP checks fixed daylight-saving dates forever.
- **Writes** go only through `book_appointment`, `reschedule_booking` and `cancel_booking` (security definer). No API role can write `bookings` directly, not even the service role. Each one: checks the caller (a member of the business, or the service role, which acts for a customer), claims the idempotency key (an identical earlier request returns its booking; the same key with different details is refused; a request that fails rolls its key back), applies the rules, and lets the exclusion constraint settle races. Without a staff member, `book_appointment` takes the first one free in a fixed order (`created_at`, then `id`), moving on if another request takes them a moment earlier. A moved booking keeps its id, reference and price; its length comes from the service as it is now.
- **Customers versus staff:** the cancellation window (`cancellation_notice_hours`) applies only to the service role, that is to customers through the assistant. Members can always move or cancel an upcoming booking, and every member (staff included) can take bookings.
- **Refusals** raise their own SQLSTATE codes, which callers translate (`src/lib/booking-errors.ts` for the dashboard): `HB001` taken, `HB002` not open, `HB003` too soon, `HB004` too far ahead, `HB005` service or staff member can't be booked, `HB006` idempotency key reused for another request, `HB007` too late for a customer to change, `HB008` booking can't be changed (cancelled or started).
- `day_bookings(business, day)` lists one local day's bookings, with the day's boundaries converted in Postgres.

## AI models and usage

- `EMBEDDING_MODEL` picks the embedding model: an ID from `src/lib/ai/catalog.ts` (called through the AI Gateway with `AI_GATEWAY_API_KEY`, or the deployment's OIDC token on Vercel), or `offline`. Unset or unknown is an error, never a silent default. `pnpm env:local` writes `EMBEDDING_MODEL=offline` when `.env.local` has none.
- `offline` (`src/lib/ai/offline-embedding.ts`) is an AI SDK embedding model that hashes words into the same 1536 dimensions, with the same Arabic normalization as keyword search. It needs no key and is deterministic, so tests, CI and keyless development never call a real model. It knows words, not meaning: judge retrieval quality only with a real model.
- The catalog holds each supported model's price (to compute what a call cost) and its relevance threshold (`minSimilarity`, tuned by the evaluation suite). Adding a model means adding it there.
- Every model call goes through a helper that records it in `model_calls` (business, purpose, model, tokens, cost in USD, latency, error name): `embedTexts` (`src/lib/ai/embeddings.ts`) for embeddings, and its Phase 4 counterpart for chat. The gateway doesn't return a cost for embeddings, so cost is tokens times the catalog price; the gateway's spend report is the bill to reconcile against. A failed call is recorded too. `model_calls` is written only by server code through `createAdminClient()` (`src/lib/supabase/admin.ts`, the only service-role client in the app) and is append-only; owners and admins can read their business's rows.

## The knowledge base

- `knowledge_documents` (FAQs and policies, English or Arabic, archivable, audited) and `knowledge_chunks` (the passages search returns: content, SHA-256 `content_hash`, `embedding_model`, `embedding vector(1536)`, and generated keyword `words`).
- Passages (`passagesOf`, `src/lib/knowledge/chunks.ts`): an FAQ is one passage (question and answer together); a policy is packed into passages of whole paragraphs, splitting long paragraphs between sentences (Arabic ؟ included), each passage prefixed with the policy's title.
- Saving (`saveDocument`, `src/lib/knowledge/indexing.ts`): split, embed only passages whose hash and model aren't already stored, then `save_knowledge_document` (security definer, owners and admins) replaces the document and its passages in one transaction. Nobody writes chunks directly; the service role only reads. Changing `EMBEDDING_MODEL` leaves documents on the old model until re-indexed (the Knowledge tab offers it), because search never compares embeddings from different models.
- Search (`search_knowledge`, wrapped by `searchKnowledge` in `src/lib/knowledge/search.ts`): by meaning (cosine similarity at or above the model's threshold, same model only) and by the question's rare words (in at most a quarter of the business's passages, or in one when there are fewer than eight), merged by reciprocal rank fusion (k = 60). A passage neither signal matched is never returned, so an empty result means "say you don't know". The business filter is in the query, so even the service role can't reach another business's passages.
- Keyword words (`private.search_words`) are lowercased, with Arabic vowel marks and tatweel removed, letter variants unified (أإآٱ to ا, ة to ه, ى to ي), and words that start like the article (ال, لل, بال, ...) kept both whole and without it, since letters alone can't tell an article from a word that starts that way (إلغاء normalizes to الغاء).
- No approximate vector index, on purpose: a business has at most a few hundred passages, which an exact scan (through the `business_id` index) handles fast with perfect recall, while an HNSW index shared by all businesses filters after its approximate search and can miss a business's best matches.

## App structure

- `src/proxy.ts` refreshes the Supabase session on each request (Next.js 16 calls middleware "proxy").
- Business pages live under `/dashboard/b/[slug]/`. A page loads its business with `requireMemberBusiness(slug, path, roles)` (`src/lib/business.ts`): visitors are sent to sign in, and anyone without one of `roles` gets a 404, so pages never confirm that a business exists. Server Actions use `memberForAction(slug, path)` and check the role themselves, because their arguments come from the browser; RLS checks again in the database.
- Forms that book, move or cancel carry an idempotency key generated when the page renders (`randomUUID()` on the server), so a double click or a retried request can't act twice. Multi-step choices (service, staff, day) are plain GET forms whose choices live in the URL; only the final step is a Server Action.
- Phone numbers are typed in any common format (Arabic digits too) and stored as E.164 by `normalizePhone` (`src/lib/phone.ts`, libphonenumber's full metadata, server side). The country code is required: a business can have customers from several countries, so we never guess one.

## Testing conventions

- Unit tests sit next to the code they test as `*.test.ts`; Vitest only looks inside `src/`. End-to-end specs live in `e2e/` and only Playwright runs them.
- pgTAP tests live in `supabase/tests/database/*.test.sql`. Each file runs in a transaction and rolls back. `000_setup.test.sql` runs first and defines helpers in a `tests` schema that only exists in test databases: `tests.create_user(email)`, `tests.authenticate_as(email)` (the API's `authenticated` role with `auth.uid()` set), `tests.authenticate_as_anon()`, `tests.authenticate_as_service_role()`, and `tests.act_as_database()` to go back to the database role with no claims left over.
- RLS denies silently on SELECT/UPDATE/DELETE (the rows just aren't there) but raises on INSERT and on missing grants. Test both kinds: check state after a refused update, and use `throws_ok` with the exact message for refused inserts. Prefer whole-row assertions (`results_eq`) over single values.
- Concurrency guarantees (no double bookings, idempotent requests) are proven in `supabase/tests/concurrency/` with Vitest and the `pg` driver: many connections call the booking functions at once, each in its own transaction as the `authenticated` role, the way API requests would. pgTAP can't, because it runs in one session.
- More pgTAP helpers: `tests.get_user_id(email)`, `tests.business_id(slug)`, and `tests.clear_tenant_data()`, which empties every tenant table so a file starts from a known state. `audit_log` can't be emptied (it's append-only), so audit tests look only at the businesses they create.
- Insert fixtures the way the API would: a column grant refuses values the app never sends (an explicit `id`, for example), so look rows up by name instead of choosing ids.
- A test must be able to fail. When adding one, break the rule once (drop the constraint, re-grant, change the code) and confirm the test goes red, then `pnpm supabase db reset` to rebuild.
- E2E specs set up their data through `e2e/support/` (`createConfirmedUser`, `createBusinessFor`, `addMember`, `addService`, `addStaffMember`, `setHoursFor`, ...) with unique names, so specs run in parallel and never depend on each other. Each spec tests what a user sees and does through the UI; the helpers only build the starting point.
- Before committing, run E2E the way CI does: `pnpm build` then `CI=1 pnpm test:e2e`. The dev server compiles each route on its first visit, which makes parallel runs against `pnpm dev` time out at random.
- Every page gets an accessibility check: `accessibilityViolations(page)` (`e2e/support/accessibility.ts`) runs axe's WCAG 2.1 A and AA rules and must return `[]`.
- Tests never call a real model: embeddings use the `offline` model (the E2E server runs with `EMBEDDING_MODEL=offline`), and tools and the chat route will be tested with the AI SDK's mock language model. Only the evaluation suite (Phase 6), run on demand, uses real models, and logs what it cost.
- In pgTAP, build embeddings with exact geometry (unit vectors along chosen dimensions) so similarities are known in advance; see `knowledge_search.test.sql`.

## Folder structure

```
src/
  app/               Next.js App Router routes and layouts
    (auth)/          Sign up, sign in, check your email
    auth/confirm/    The email confirmation link's route
    (app)/dashboard/ Signed-in pages: the user's businesses, and b/[slug]/ for one business
  components/        Shared components (ActionButton, ServiceName)
  components/ui/     shadcn/ui components (owned code, edited freely)
  config/            App-wide constants (the product name lives here)
  lib/               Helpers: auth, business access, money, dates, hours, booking rules, ...
  lib/ai/            Model catalog, the offline embedding model, logged embedding calls
  lib/knowledge/     Passages, indexing and search of the knowledge base
  lib/supabase/      Supabase clients (user, and the admin client for the usage log) and types
  proxy.ts           Session refresh on every request
scripts/             Dev tooling (writing .env.local)
e2e/                 Playwright end-to-end specs (*.spec.ts)
  support/           E2E helpers (accessibility, users, businesses, forms, Mailpit)
supabase/
  config.toml        Local Supabase settings (ports 553xx; unused services off)
  migrations/        SQL migrations, applied in filename order
  tests/database/    pgTAP tests for schema, privileges and RLS
  tests/concurrency/ Vitest + pg: many connections booking at once
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
| `pnpm test:concurrency`             | Parallel-connection booking tests (Supabase running)    |
| `pnpm supabase start` / `stop`      | Start / stop local Supabase (needs Docker running)      |
| `pnpm env:local`                    | Write the local Supabase URL and keys into `.env.local` |
| `pnpm supabase db reset`            | Rebuild the local database from migrations              |
| `pnpm db:types`                     | Regenerate TypeScript types from the local database     |

First Playwright run on a machine: `pnpm exec playwright install chromium`. With `CI=1`, Playwright serves the production build (`pnpm build` first) instead of the dev server, exactly like CI.

## CI

GitHub Actions runs on every push to `main` and every pull request, as three parallel jobs:

- **checks**: `format:check`, `lint`, `typecheck`, `test`
- **database**: starts only Postgres (`pnpm supabase db start`, which applies every migration from scratch), runs `test:db` and `test:concurrency`, then checks the generated types are current
- **e2e**: starts local Supabase (without Studio), writes `.env.local`, builds for production, then runs Playwright

Every CI step is a `pnpm` script, so anything that fails in CI can be reproduced locally with the same command. Keep it that way.

## Local setup notes

- Local Supabase needs Docker Desktop running (on Windows with the WSL 2 backend). If tests suddenly fail with `fetch failed`, `ECONNREFUSED` or "cannot connect to the docker API", Docker has stopped: start Docker Desktop, then `pnpm supabase start` (the data is kept). The Supabase CLI is a pinned dev dependency, so always call it through `pnpm supabase`, never a global install.
- The local stack uses ports 553xx (API 55321, database 55322, Studio 55323, Mailpit 55324) and the app runs on 3100, so it can run next to another local Supabase project on the CLI's default 543xx ports and an app on 3000. Running both stacks at once needs a few GB of memory; stop the one you're not using (`pnpm supabase stop` keeps its data).
