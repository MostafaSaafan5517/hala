@AGENTS.md

# Hala: project guide

An AI receptionist for appointment-based businesses (salons, clinics, studios, consultants), in Arabic and English. A business sets up its services, staff, working hours, booking rules, FAQs and policies; customers chat with the assistant through an embeddable website widget, which answers questions from the business's own data, checks real availability, and books, reschedules or cancels appointments. Staff see conversations and bookings and can take a conversation over.

This is a public portfolio project. Test coverage, clear decisions, and a clean commit history matter as much as features. Every part must be explainable in a client interview, especially retrieval, tool calling, grounding and the double-booking constraint.

The product name is a working name. In code it lives only in `src/config/app.ts`; never hard-code it anywhere else in `src/`. The docs (`README.md`, this file) use it by name.

## Stack

- Next.js 16 (App Router), TypeScript in strict mode plus `noUncheckedIndexedAccess`
- Tailwind CSS v4 + shadcn/ui (Base UI, `base-nova` style, RTL enabled)
- Supabase: Postgres, Auth, Row-Level Security, pgvector. Local development with the Supabase CLI and SQL migrations
- AI through the Vercel AI SDK (v7) and the Vercel AI Gateway: one key, models named `provider/model` and chosen in env, never in code. Embeddings: `cohere/embed-v4.0`; chat: `openai/gpt-5-mini` at low reasoning effort, both chosen by the evaluation suite among the models the gateway's free tier covers (it covers neither Claude nor OpenAI's embeddings). Claude and other models stay in the catalog for paid credit, and each kind has an `offline` stand-in. This is a no-spend personal project: real-model use stays within the AI Gateway's free credit ($5 every 30 days). Zod validates every tool input and structured model output. The AI SDK changes often: read its bundled docs in `node_modules/ai/docs/` before using an API, never memory
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
- UI primitives come from shadcn/ui. Add one with `pnpm dlx shadcn@latest add <name>`; it is copied into `src/components/ui/` and becomes our code to edit. Merge class names with `cn` (`@/lib/utils`), never the `cn` package directly: ours uses merge tables built from the theme (`src/lib/cn-tables.ts`, written by `pnpm tokens`), without which `text-body` counts as a color and drops the text color beside it.
- Layouts must work right-to-left for Arabic: use logical classes (`ms-`/`me-`, `ps-`/`pe-`, `start-`/`end-`, `text-start`), never `left`/`right` ones. shadcn generates logical classes because `rtl` is on in `components.json`.
- Anything that navigates is a `<Link>`, even when it looks like a button: style it with `buttonVariants()`, which merges its classes like `<Button>` does. Never `<Button render={<Link />}>`, which gives the link `role="button"`.
- Use theme tokens (`bg-background`, `text-muted-foreground`, `border-border`, ...) instead of raw colors. The design system is docs/design/DESIGN.md; its tokens live in `src/styles/tokens.css` (`--hala-*`, light and dark), and `src/app/globals.css` maps shadcn's names onto them (the table is in docs/design/TOKENS.md; note that `primary` is the solid teal and `accent` the soft one). Text sizes are `text-display` ... `text-caption`; Arabic line heights adjust automatically, and Arabic text never gets `tracking-*`. Colors follow the device's light or dark setting; `.hala-light` and `.hala-dark` force one (the widget and the demo salon are `.hala-light`). After changing a token or a theme name, run `pnpm tokens`; `src/styles/tokens.test.ts` checks the export, the two dark copies and WCAG AA contrast, and `src/lib/utils.test.ts` checks the merge tables. Icons are Phosphor (`@phosphor-icons/react`, `/ssr` in server components).
- Money is always an integer in the currency's smallest unit. Convert only for display, with `src/lib/money.ts`: the number of decimals comes from the currency (`minorUnitDigits`: 2 for EGP, 3 for KWD, 0 for JPY), never a hard-coded 100, and `parseAmount` accepts Arabic-Indic digits and separators.
- Arabic text is always marked `lang="ar"` (plus `dir="rtl"` on blocks). Readex Pro sets both scripts, so Arabic needs no font of its own; `globals.css` gives `:lang(ar)` its line heights. Text whose language we don't know (names, typed input) gets `dir="auto"`. `ServiceName` (`src/components/service-name.tsx`) shows a service's names this way.
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
- Every table in `public` gets the read-only guard: `create trigger read_only_accounts_cannot_write before insert or update or delete on public.<table> for each statement execute function private.refuse_read_only()`. It refuses writes (HB010) from accounts whose `app_metadata.read_only` is true (the public demo's); `read_only.test.sql` fails for a table without it.
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
- `member_invites`: invite links (role `admin` or `staff`, the SHA-256 of a random token, expiry after 7 days, who accepted). Owners invite admins or staff, admins invite staff; `accept_member_invite` (security definer) adds the signed-in user once.
- `businesses.widget_enabled` and `widget_origins` (at most 10 origins: scheme, host and optional port, lowercase): whether the website widget is on, and which sites may show it.
- `conversations` (channel `test` or `widget`, the customer the assistant acts for once known, status `open`, `needs_human`, `taken_over` or `closed`, failed verification attempts; for the widget, the SHA-256 of the visitor's token and a keyed hash of their IP address; who took it over) and `conversation_messages` (each AI SDK UI message as JSON, by position; `sent_by` for a staff reply). Written only by server code and the inbox's functions; members read their business's.
- `tool_calls`: every tool call the assistant made (input, output, status `succeeded`, `failed` or `declined`, whether the customer approved it, latency). Append-only; owners and admins read it.

## The booking engine

- **Availability** is one SQL function, `private.free_slots`, wrapped by `public.available_slots(service, from_date, to_date, staff?, ignored_booking?)` (at most 31 days per call). The slot pickers and the booking functions both use it, so what is offered and what is accepted can't disagree. A start is offered when it is on the interval grid counted from local midnight, the appointment fits a working span (the staff member's own hours, else the business's), the day isn't a closure, it is past the notice and within the horizon, and the appointment plus buffer avoids time off and confirmed bookings (theirs include their buffers). The buffer may run past closing. Days are converted to UTC one at a time, so each uses its own offset. `free_slots` takes the clock as a parameter (`now_at`), which is how pgTAP checks fixed daylight-saving dates forever.
- **Writes** go only through `book_appointment`, `reschedule_booking` and `cancel_booking` (security definer). No API role can write `bookings` directly, not even the service role. Each one: checks the caller (a member of the business, or the service role, which acts for a customer), claims the idempotency key (an identical earlier request returns its booking; the same key with different details is refused; a request that fails rolls its key back), applies the rules, and lets the exclusion constraint settle races. Before writing, it takes a transaction lock on the staff member's schedule (`pg_advisory_xact_lock`), so simultaneous requests for one staff member queue: without it, two overlapping inserts can each wait for the other inside the constraint check, and Postgres cancels one with a deadlock error (40P01) instead of the refusal (HB001). The lock only orders requests; the constraint still refuses the overlap. Without a staff member, `book_appointment` takes the first one free in a fixed order (`created_at`, then `id`), moving on if another request takes them a moment earlier. A moved booking keeps its id, reference and price; its length comes from the service as it is now.
- **Customers versus staff:** the cancellation window (`cancellation_notice_hours`) applies only to the service role, that is to customers through the assistant. Members can always move or cancel an upcoming booking, and every member (staff included) can take bookings.
- **Refusals** raise their own SQLSTATE codes, which callers translate (`src/lib/booking-errors.ts` for the dashboard): `HB001` taken, `HB002` not open, `HB003` too soon, `HB004` too far ahead, `HB005` service or staff member can't be booked, `HB006` idempotency key reused for another request, `HB007` too late for a customer to change, `HB008` booking can't be changed (cancelled or started). The inbox adds `HB009`: the conversation's status doesn't allow that (replying before taking over, taking over a closed one).
- `day_bookings(business, day)` lists one local day's bookings, with the day's boundaries converted in Postgres.

## AI models and usage

- `EMBEDDING_MODEL` picks the embedding model: an ID from `src/lib/ai/catalog.ts` (called through the AI Gateway with `AI_GATEWAY_API_KEY`, or the deployment's OIDC token on Vercel), or `offline`. Unset or unknown is an error, never a silent default. `pnpm env:local` writes `EMBEDDING_MODEL=offline` when `.env.local` has none.
- `offline` (`src/lib/ai/offline-embedding.ts`) is an AI SDK embedding model that hashes words into the same 1536 dimensions, with the same Arabic normalization as keyword search. It needs no key and is deterministic, so tests, CI and keyless development never call a real model. It knows words, not meaning: judge retrieval quality only with a real model.
- The catalog holds each supported model's price (to compute what a call cost) and, for embeddings, its relevance threshold (`minSimilarity`, tuned by the evaluation suite). Adding a model means adding it there. `CHAT_MODEL` picks the chat model the same way (`src/lib/ai/chat-model.ts`).
- The `offline` chat model (`src/lib/ai/offline-chat.ts`) is rule-based: it looks every question up and answers with the best passage, citing it, or says it doesn't know; and it carries out one exact request, "book <service> on <YYYY-MM-DD> at <HH:MM> for <name>, <+phone>", through the real tools, approval included. Tests and keyless development use it.
- `TOOL_APPROVAL_SECRET` (at least 32 random characters, the same on every server) signs approvals. `pnpm env:local` generates one locally, and sets both models to `offline`, when they're missing.
- Every model call goes through a helper that records it in `model_calls` (business, purpose, model, tokens, cost in USD, latency, error name): `embedTexts` (`src/lib/ai/embeddings.ts`) for embeddings, and its Phase 4 counterpart for chat. The gateway doesn't return a cost for embeddings, so cost is tokens times the catalog price; the gateway's spend report is the bill to reconcile against. A failed call is recorded too. `model_calls` is written only by server code through `createAdminClient()` (`src/lib/supabase/admin.ts`, the only service-role client in the app) and is append-only; owners and admins can read their business's rows.

## The assistant

- **One turn** (`runAssistantTurn`, `src/lib/assistant/turn.ts`): load the conversation from the database, add the customer's new message or apply their answers to approval requests, check the limits, then stream a `ToolLoopAgent` (at most 8 steps) and save the messages when the stream ends. The browser never sends history (`prepareSendMessagesRequest` sends only `{ text }` or `{ approvals }`), so it can't rewrite what was said or invent an approval: answers are applied only to requests the server stored.
- **Tools** (`createAssistantToolkit`, `src/lib/assistant/toolkit.ts`): `search_knowledge`, `business_info`, `check_availability`, `book_appointment`, `find_bookings`, `reschedule_booking`, `cancel_booking`, `request_human`. Every query is scoped to the conversation's business: the booking functions trust the service role, so the tools themselves must refuse another business's ids (tests prove it). Every call is recorded in `tool_calls` by `audited`.
- **Approvals**: booking, moving and cancelling use the AI SDK's `toolApproval`. The approval function first checks the request can go ahead (the time is free, the booking belongs to the verified customer, it's outside the cancellation window) and refuses it with a reason the model can act on, or words it for the customer from the database, in their language (`src/lib/assistant/summaries.ts`). Approvals are signed with `TOOL_APPROVAL_SECRET` (`experimental_toolApprovalSecret`), binding them to the exact tool call and input; a declined request never runs and is recorded as `declined`.
- **Idempotency**: a booking tool's key is `assistant:<toolCallId>`, so the same call running again returns the same result.
- **Customers proving a booking is theirs**: its reference plus their phone number (`find_bookings`), five attempts per conversation. A customer who booked in the conversation doesn't need to.
- **Limits** (`src/lib/assistant/limits.ts`, from `chat_usage`): tokens per conversation, chat calls per business per minute, and spend per business per local day. Over a limit, the customer gets a fixed reply in their language, no model is called, and spent budgets hand the conversation to a person.
- **Instructions** (`src/lib/assistant/instructions.ts`) ask for answers only from tools, with numbered citations, "I don't know" plus a person otherwise, and documents and messages treated as information, never instructions. The rules that matter don't depend on the model obeying them: tools and the database enforce them, and tests use a scripted model that obeys injected instructions to prove it.
- **Model usage**: each step's tokens, cost and latency go to `model_calls` with the conversation, from the agent's `onStepEnd`.
- **Routes**: members test through `/api/assistant/[conversationId]` (test conversations only, RLS decides who sees them); the widget's visitors through `/api/widget/[slug]/chat`. Both run the same turn.
- **While a person has the conversation** (`taken_over`), a turn saves the customer's message and answers nothing; a closed conversation refuses turns (409).

## The knowledge base

- `knowledge_documents` (FAQs and policies, English or Arabic, archivable, audited) and `knowledge_chunks` (the passages search returns: content, SHA-256 `content_hash`, `embedding_model`, `embedding vector(1536)`, and generated keyword `words`).
- Passages (`passagesOf`, `src/lib/knowledge/chunks.ts`): an FAQ is one passage (question and answer together); a policy is packed into passages of whole paragraphs, splitting long paragraphs between sentences (Arabic ؟ included), each passage prefixed with the policy's title.
- Saving (`saveDocument`, `src/lib/knowledge/indexing.ts`): split, embed only passages whose hash and model aren't already stored, then `save_knowledge_document` (security definer, owners and admins) replaces the document and its passages in one transaction. Nobody writes chunks directly; the service role only reads. Changing `EMBEDDING_MODEL` leaves documents on the old model until re-indexed (the Knowledge tab offers it), because search never compares embeddings from different models.
- Search (`search_knowledge`, wrapped by `searchKnowledge` in `src/lib/knowledge/search.ts`): by meaning (cosine similarity at or above the model's threshold, same model only) and by the question's rare words (in at most a quarter of the business's passages, or in one when there are fewer than eight), merged by reciprocal rank fusion (k = 60). A passage neither signal matched is never returned, so an empty result means "say you don't know". The business filter is in the query, so even the service role can't reach another business's passages.
- Keyword words (`private.search_words`) are lowercased, with Arabic vowel marks and tatweel removed, letter variants unified (أإآٱ to ا, ة to ه, ى to ي), and words that start like the article (ال, لل, بال, ...) kept both whole and without it, since letters alone can't tell an article from a word that starts that way (إلغاء normalizes to الغاء).
- No approximate vector index, on purpose: a business has at most a few hundred passages, which an exact scan (through the `business_id` index) handles fast with perfect recall, while an HNSW index shared by all businesses filters after its approximate search and can miss a business's best matches.

## The website widget

- **Embedding**: `public/widget.js` is the one script tag a business adds (`data-business="<slug>"`, optional `data-language` and `data-label`). It adds a launcher button and, on first open, an iframe of `/widget/[slug]`, so the chat is isolated from the site's styles and scripts; the site gets only the button and the frame, styled inline. The frame asks to be closed with a `hala:close` message, which the script accepts only from Hala's origin. The file is minified from `src/embed/widget.js` by `pnpm widget` (`src/embed/widget.test.ts` fails when it's stale or over its 2,917-byte limit): edit the source, never the output.
- **Where it may show**: the proxy gives `/widget/[slug]` a `Content-Security-Policy: frame-ancestors 'self' <allowed origins>` header, read per request (`src/lib/widget/frame-policy.ts`) so a newly allowed site works at once; if the lookup fails, it falls back to `'self'` only. Every other page gets `frame-ancestors 'none'` from `next.config.ts`. Browsers enforce it, so the widget can't be shown on someone else's site.
- **Visitors** have no account. `POST /api/widget/[slug]/conversations` returns a random token, kept in the visitor's browser (localStorage, else memory); only its SHA-256 is stored. `chat` and `messages` take it as a bearer token. All three routes answer only requests from Hala's own pages (`fromOwnPages` checks `Origin` and `Sec-Fetch-Site`), so a script on another site can't use a visitor's browser.
- **Per-visitor limits** (`src/lib/widget/server.ts`, from `visitor_usage`): new conversations per hour and chat calls per minute, counted by a keyed hash of the IP address a conversation started from (HMAC with a key derived from `TOOL_APPROVAL_SECRET`), never the address itself. On Vercel the platform sets `x-real-ip` from the connection and ignores a client's own header (checked on the live deployment). The business's own limits apply too.
- **The frame's page** (`src/app/widget/[slug]/`) shares the chat components with the dashboard's test chat (`src/components/chat/`: messages, a safe Markdown subset, the Confirm card, the composer). It switches between Arabic and English, picks the conversation up after a reload, and checks for the team's replies every 5 seconds while a conversation is going.
- **Settings**: the Widget tab (owners and admins) turns it on, takes the allowed sites (`parseOrigins`, `src/lib/widget/origins.ts`), and shows the embed code and a live preview.

## The staff inbox

- The Inbox tab (every member) lists widget conversations: those waiting for the team (`needs_human`, then `taken_over`, the longest waiting first), then the 20 most recent others. The list and a conversation re-render on the server every 5 seconds while the tab is in view.
- A conversation shows the customer (once known), the whole transcript with every tool step (what it was asked and what came back), and the actions: take over, hand back, close, and reply while taken over.
- Each action is a security definer function (`take_over_conversation`, `hand_back_conversation`, `close_conversation`, `reply_to_conversation`) that locks the conversation, checks the caller is a member of its business (an outsider can't tell it from one that doesn't exist), and checks the status (`HB009` otherwise). A reply is built in the database from plain text, marked `metadata.from = 'staff'`, with `sent_by`, so it can't carry anything that looks like the assistant's tools.

## The team

- The Team tab lists members and, for owners and admins, pending invites. Invite links are made, shared and revoked there; `/invite/[token]` shows what a link is for and joins once signed in. Only the owner changes roles (admin or staff). The owner removes admins or staff, admins remove staff, and anyone but the owner can leave.

## The Usage tab

- `usage_by_day(business, first_day, last_day)` and `usage_by_model(...)` (security invoker, owners and admins, 1 to 92 days) aggregate `model_calls`, widget `conversations` and `tool_calls` per local day: each day's midnights are converted in Postgres, so daylight saving is right. Latency percentiles are over successful chat calls; bookings and requests for a person come from succeeded tool calls.
- The tab (`/dashboard/b/[slug]/usage`, 7 or 30 days) shows the totals, today's spend against `BUSINESS_DAILY_BUDGET_USD` as a meter, a spend-per-day chart (one series in the `--chart-1` hue, readable from the keyboard) and day-by-day and per-model tables with every value. Costs under a dollar keep up to four decimals.

## The evaluation suite

- `pnpm eval` (`vitest.evals.config.mts`, `evals/`): never in CI. It uses `CHAT_MODEL`, `EMBEDDING_MODEL` and `AI_GATEWAY_API_KEY` from `.env.local`; a variable set in the shell wins, so one run can try another model.
- `evals/salon.ts` builds the salon every case talks to: the integration suite's salon plus FAQs and policies in both languages, one poisoned document, and two existing bookings (one inside the 72-hour window, one outside).
- `evals/cases.ts`: each case is the customer's turns (text, or an answer to the confirmation card), mechanical expectations, and a rubric for the judge. `evals/checks.ts` scores the expectations from the tool log and stored messages; `evals/judge.ts` sends the transcript, with every tool call and result, to a judge model (`EVAL_JUDGE_MODEL`, default GPT-5 mini; `off` for the offline model; cross-check a close result with another judge, since a model may grade itself kindly) for a structured verdict: grounded, followed the rubric, right language, safe. A case passes when every check and the verdict pass.
- `evals/run.eval.ts` runs the cases one at a time, stops starting new ones at `EVAL_BUDGET_USD` (default 1.50), and writes `evals/reports/<time>-<model>.md` and `.json` (gitignored), with each failing case's transcript.
- `evals/retrieval.eval.ts` reports every passage's similarity to 18 questions (cross-language and unanswerable ones included) and, per threshold, how many answerable questions keep a right passage against how many unanswerable ones get a wrong one. Each embedding model's `minSimilarity` in the catalog comes from this report.
- To add a case: give it an id, turns, expectations that a wrong reply would fail, and a rubric that says what a good reply does. Run it alone with `EVAL_CASES=<id>`.

## The public demo

- On a deployment with `DEMO_ENABLED=1`, `/api/demo/reset` (run daily by the cron in `vercel.json`, with `Authorization: Bearer <CRON_SECRET>`) sets the demo up the first time and clears it every night after (`src/lib/demo/setup.ts`, data in `src/lib/demo/salon.ts`): the read-only owner account (`src/config/demo.ts`, a public login on purpose), Nour Salon (`businesses.is_demo`, which only server code sets), its services, staff, hours and bilingual knowledge, then two sample bookings and a conversation waiting for the team. `reset_demo_business` clears conversations, bookings and customers, and refuses any business not marked `is_demo`.
- Read-only accounts: the database refuses their writes (see the read-only guard above); `memberForAction` sends them back to the page with `?read-only=1`, and the signed-in layout's banner explains. Starting a test chat opts out (`allowReadOnly`), since only server code writes there.
- `/demo` is the salon's website with the real widget (`next/script` with the `data-` attributes), rendered per request (`connection()`); the home and sign-in pages point to it.
- Spending: `BUSINESS_DAILY_BUDGET_USD` (default 5) per business and local day, and `SITE_DAILY_BUDGET_USD` (no limit when unset) for every business together per UTC day (`chat_usage` returns both); the demo keeps them inside the AI Gateway's free credit.

## App structure

- `src/proxy.ts` refreshes the Supabase session on each request (Next.js 16 calls middleware "proxy") and sets the widget page's frame policy; the widget's API routes skip the session refresh (visitors have none).
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
- Tests never call a real model. `playwright.config.ts` and `vitest.integration.config.mts` set `EMBEDDING_MODEL` and `CHAT_MODEL` to `offline` before loading `.env.local`, so they win over whatever the file says (and the app under test inherits them); the chat route and tools are tested with the offline model or a scripted `MockLanguageModelV4`. Only the evaluation suite, run on demand, uses real models, and it reports what it cost.
- The integration suite (`integration/`, `pnpm test:integration`) runs app code (the assistant's tools and turns) against the full local stack with the offline models. A scripted `MockLanguageModelV4` plays exactly the tool calls a test needs, including a misbehaving model's. Its Vitest config loads `.env.local` and aliases `server-only` to its empty module.
- In pgTAP, build embeddings with exact geometry (unit vectors along chosen dimensions) so similarities are known in advance; see `knowledge_search.test.sql`.
- Widget specs give each browser context its own visitor address (`asNewVisitor()`, `e2e/support/visitors.ts`), since per-visitor limits count by IP and every local request shares one. Integration tests do the same with random `10.x` addresses.
- The embed test serves its fake business sites from small HTTP servers on loopback ports, not routed public domains: Chrome blocks a public page from loading a script from localhost (Private Network Access), where the app under test runs.
- Visitor and staff pages check for changes every 5 seconds, so assertions that wait for the other side use a longer timeout (`{ timeout: 15_000 }`).

## Folder structure

```
src/
  app/               Next.js App Router routes and layouts
    (auth)/          Sign up, sign in, check your email
    auth/confirm/    The email confirmation link's route
    (app)/dashboard/ Signed-in pages: the user's businesses, and b/[slug]/ for one business
  app/widget/        The widget's page, shown in the frame on a business's site
  components/        Shared components (ActionButton, ServiceName)
  components/chat/   The chat shared by the widget and the dashboard's test chat
  components/ui/     shadcn/ui components (owned code, edited freely)
  embed/             The embed script's source (`pnpm widget` minifies it to public/widget.js)
  styles/            The design tokens (tokens.css), shared with other Hala projects
  config/            App-wide constants (the product name lives here)
  lib/               Helpers: auth, business access, money, dates, hours, booking rules, ...
  lib/ai/            Model catalog, the offline embedding model, logged embedding calls
  lib/knowledge/     Passages, indexing and search of the knowledge base
  lib/assistant/     The assistant: tools, approvals, instructions, limits, turns
  lib/widget/        Frame policy, allowed origins, visitor tokens and limits
  lib/demo/          The public demo's salon, its setup and nightly reset
  app/api/           Route handlers (the assistant's chat, and the widget's)
  lib/supabase/      Supabase clients (user, and the admin client for the usage log) and types
  proxy.ts           Session refresh on every request
public/widget.js     The embed script businesses add to their sites (minified from src/embed/widget.js)
scripts/             Dev tooling (writing .env.local)
e2e/                 Playwright end-to-end specs (*.spec.ts)
  support/           E2E helpers (accessibility, users, businesses, knowledge, forms, visitors, sites, Mailpit)
integration/         Vitest against the full local stack: the assistant's tools and turns
evals/               The evaluation suite: scripted conversations and retrieval, scored (on demand)
docs/                How it works, for reviewers, with screenshots (docs/images/)
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

| Command                             | What it does                                                                                                                                       |
| ----------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm dev`                          | Dev server at http://localhost:3100                                                                                                                |
| `pnpm build` / `pnpm start`         | Production build / serve that build (port 3100)                                                                                                    |
| `pnpm lint`                         | ESLint; fails on any warning                                                                                                                       |
| `pnpm typecheck`                    | Generates Next.js route types, then runs `tsc`                                                                                                     |
| `pnpm format` / `pnpm format:check` | Prettier: rewrite files / check only (CI uses check)                                                                                               |
| `pnpm test` / `pnpm test:watch`     | Vitest unit tests: single run / watch mode                                                                                                         |
| `pnpm test:e2e`                     | Playwright; starts `pnpm dev` itself if not running                                                                                                |
| `pnpm test:db`                      | pgTAP database tests (Supabase must be running)                                                                                                    |
| `pnpm test:concurrency`             | Parallel-connection booking tests (Supabase running)                                                                                               |
| `pnpm test:integration`             | The assistant against the full local stack                                                                                                         |
| `pnpm eval`                         | The evaluation suite (real models cost money; on demand)                                                                                           |
| `SCREENS_DIR=<dir> pnpm screens`    | Screenshots of every screen and state at desktop and mobile, with axe (`pnpm build` first; `LIGHTHOUSE=1` adds Lighthouse, from a normal terminal) |
| `pnpm tokens`                       | Export the design tokens to `docs/design/tokens.json` and rebuild `cn`'s merge tables from the theme                                               |
| `pnpm widget`                       | Minify the embed script (`src/embed/widget.js`) to `public/widget.js`                                                                              |
| `pnpm supabase start` / `stop`      | Start / stop local Supabase (needs Docker running)                                                                                                 |
| `pnpm env:local`                    | Write the local Supabase URL and keys into `.env.local`                                                                                            |
| `pnpm supabase db reset`            | Rebuild the local database from migrations                                                                                                         |
| `pnpm db:types`                     | Regenerate TypeScript types from the local database                                                                                                |

First Playwright run on a machine: `pnpm exec playwright install chromium`. With `CI=1`, Playwright serves the production build (`pnpm build` first) instead of the dev server, exactly like CI.

## CI

GitHub Actions runs on every push to `main` and every pull request, as three parallel jobs:

- **checks**: `format:check`, `lint`, `typecheck`, `test`
- **database**: starts only Postgres (`pnpm supabase db start`, which applies every migration from scratch), runs `test:db` and `test:concurrency`, then checks the generated types are current
- **e2e**: starts local Supabase (without Studio), writes `.env.local`, runs the integration suite, builds for production, then runs Playwright

Every CI step is a `pnpm` script, so anything that fails in CI can be reproduced locally with the same command. Keep it that way.

## Deployment

- Production is https://hala-phi.vercel.app: the Vercel project `hala`, connected to the GitHub repository, so every push to `main` deploys. Its environment variables are set in the Vercel project (README, "Deploying"); AI calls use the deployment's OIDC token, so no AI key is stored there.
- The production database is a Supabase free-plan project, changed only by `pnpm supabase db push` of this repository's migrations, never in its dashboard.
- Free-plan limits: custom email templates are refused (so `supabase/config.toml` describes the local stack only) and the built-in email service sends only to the project's team, so public sign-up confirmations don't arrive without custom SMTP. The demo's account needs no email. The emails it does send use Supabase's default template, which `/auth/confirm` handles as well as ours: Supabase confirms the address and comes back with a one-time code, which signs in only the browser that signed up (it holds the PKCE verifier); in any other browser the user is told the address is confirmed and asked to sign in.

## Local setup notes

- Local Supabase needs Docker Desktop running (on Windows with the WSL 2 backend). If tests suddenly fail with `fetch failed`, `ECONNREFUSED` or "cannot connect to the docker API", Docker has stopped: start Docker Desktop, then `pnpm supabase start` (the data is kept). The Supabase CLI is a pinned dev dependency, so always call it through `pnpm supabase`, never a global install.
- The local stack uses ports 553xx (API 55321, database 55322, Studio 55323, Mailpit 55324) and the app runs on 3100, so it can run next to another local Supabase project on the CLI's default 543xx ports and an app on 3000. Running both stacks at once needs a few GB of memory; stop the one you're not using (`pnpm supabase stop` keeps its data).
- E2E needs port 3100: the sign-up tests follow email links to the `site_url` in `supabase/config.toml`. If another app holds 3100, stop it first rather than moving Hala.
