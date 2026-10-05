# Hala

[![CI](https://github.com/MostafaSaafan5517/hala/actions/workflows/ci.yml/badge.svg)](https://github.com/MostafaSaafan5517/hala/actions/workflows/ci.yml)

An AI receptionist for appointment-based businesses (salons, clinics, studios, consultants), in Arabic and English. Customers chat with it on the business's website: it answers questions from the business's own data, checks real availability, and books, reschedules or cancels appointments. Staff see every conversation and booking, and can take a conversation over.

**Status:** in development. Business setup (Phase 1), the booking engine (Phase 2), the knowledge base with retrieval (Phase 3), the assistant (Phase 4) and the website widget with the staff inbox (Phase 5) are done; the evaluation suite and usage dashboard are next. See the [roadmap](#roadmap).

## What works today

- **Accounts:** sign up with email confirmation, sign in, sign out; pages that need an account send visitors to sign in and bring them back afterwards.
- **Businesses:** an owner creates a business with its own web address, time zone and the assistant's first language (English or Arabic). Each business has one owner and can have admins and staff.
- **Team invites by link:** owners invite admins or staff, admins invite staff, with a link they share however they like (single use, valid for 7 days; only its hash is stored). No email is sent, and nobody can use it to find out whether an address has an account. The owner changes roles and removes admins or staff; admins remove staff.
- **Services** with English and Arabic names, duration, buffer time and price in any common currency (stored in the currency's smallest unit; Arabic-Indic digits are accepted). Services are archived, never deleted, so past bookings keep their meaning.
- **Staff** (no account needed) and the services each one performs.
- **Working hours** for the business and, where they differ, for each staff member, with split shifts; **time off** for staff and **closures** for the whole business, entered in the business's local time and stored in UTC, daylight saving included.
- **Booking rules:** minimum notice, how far ahead customers can book, how often appointments start, and how late they can cancel.
- **Bookings** from the dashboard: a day view, booking with only truly free times offered, moving and cancelling. Customers are known by phone number (typed in any common format, Arabic digits included).
- **Availability computed in Postgres** from working hours, time off, closures, existing bookings and buffers, notice, horizon and the start-time interval, one local day at a time so daylight saving is right. The pickers and the booking check use the same function, so they can't disagree.
- **No double bookings, enforced by Postgres:** an exclusion constraint refuses any overlapping confirmed booking for the same staff member. Concurrency tests fire many simultaneous requests for one slot and prove exactly one wins; with the constraint removed, they fail.
- **Idempotent booking, moving and cancelling:** every request carries a key, so a retried or duplicated request returns the first result instead of acting twice.
- **Customers' rules versus staff:** customers (through the assistant) can't cancel or move inside the cancellation window; the business's staff always can.
- **An append-only audit log** of every change, bookings included, written by database triggers; nobody, not even the server, can edit or delete it.
- **A knowledge base** of FAQs and policies in English or Arabic, split into passages and embedded on save (only changed passages are re-embedded), with a "Try a question" box that shows exactly which passages the assistant would answer from.
- **Hybrid retrieval in Postgres:** search by meaning (pgvector cosine similarity, above a per-model threshold) and by the question's rare keywords (language-agnostic, Arabic spelling normalized), merged by reciprocal rank fusion. Nothing relevant means an empty result, never a guess. One business's passages are unreachable from another's, proven by tests.
- **The assistant** (Claude by default, switchable by configuration): answers from the knowledge base with numbered sources, or says it doesn't know and offers a person; checks real availability; books, moves and cancels through eight server-side tools, each scoped to one business and recorded in an append-only audit. Members can test it from the dashboard.
- **Confirm before anything happens:** every booking, move or cancellation is shown to the customer, worded from the database in their language, and runs only when they tap Confirm. Approvals are cryptographically signed, so a request changed after it was shown can't run; tests prove it fails without the signature.
- **Prompt injection changes nothing that matters:** tests drive a model that obeys injected instructions, and it still can't book outside the rules or at another business. Prices only ever come from the database: no tool takes one.
- **Cost controls:** every model call logged with tokens, cost and latency; a token budget per conversation, a rate limit and a daily budget per business. Over a limit, no model is called and a person takes over.
- **Every AI call logged** with tokens, cost, latency and failures, in an append-only table only server code can write.
- **A website widget:** one script tag adds a chat button to the business's site and opens the chat in an isolated frame, in Arabic or English (right to left for Arabic). Browsers show it only on the sites the business allowed: its page sends a `frame-ancestors` policy listing them, and every other page of the app refuses to be framed at all. Visitors need no account: a random token kept in their browser opens their conversation (only its hash is stored), and per-visitor limits on how many conversations they start and how fast they send messages sit on top of the business's limits.
- **A Usage tab:** what the assistant did and what it cost, per day in the business's time zone and per model: spend, website conversations, bookings it made, requests for a person, reply latency, failed calls, and today's spend against the daily budget. Computed in Postgres, for owners and admins only.
- **An evaluation suite** (`pnpm eval`, on demand): 24 scripted English and Arabic conversations with the real assistant (knowledge answers with sources, "I don't know", prices and hours, booking with confirmation, cancelling with and without proof, prompt injection in a document and a message, handover, switching language), each scored by mechanical checks on the tool log and by a judge model against a rubric; plus a retrieval report that picks each embedding model's relevance threshold. It stops at a cost cap and reports what each case cost.
- **A staff inbox:** conversations waiting for a person come first. A member sees the whole transcript, including every step the assistant took and what each tool returned, then takes the conversation over (the assistant goes quiet), replies in the customer's chat, hands it back or closes it. Each action is a database function that checks the member and the conversation's status, and a reply can only ever be plain text.
- **Roles enforced in the database:** owners and admins manage the setup, every member can take bookings, and Row-Level Security keeps every business's data invisible to every other business. pgTAP tests cover each policy, including the refusals.

## What this project will demonstrate

- **The model never writes data.** It only requests actions through server-side tools that validate every input, re-check permissions and business rules, and run inside database transactions.
- **No double bookings, enforced by Postgres** with an exclusion constraint on staff and time range, proven by a test that fires two simultaneous bookings for the same slot.
- **Grounded answers.** The assistant answers only from the business's data, shows its sources, and says it doesn't know (and hands over to a human) instead of inventing prices, services or availability.
- **Tenant isolation in the database,** vector store included: one business can never retrieve another's documents or bookings.
- **Prompt-injection resistance, idempotent actions, an append-only audit log of every tool call, and cost controls** (tokens, cost and latency logged per call; rate limits and token budgets).
- **An evaluation suite** of scripted Arabic and English conversations, run against the real model and scored.

## Stack

- [Next.js](https://nextjs.org) 16 (App Router) and TypeScript in strict mode
- [Tailwind CSS](https://tailwindcss.com) and [shadcn/ui](https://ui.shadcn.com), right-to-left ready for Arabic
- [Supabase](https://supabase.com): Postgres, Auth, Row-Level Security, pgvector, SQL migrations
- [Vitest](https://vitest.dev), [Playwright](https://playwright.dev) with [axe](https://github.com/dequelabs/axe-core) accessibility checks, and [pgTAP](https://pgtap.org)
- GitHub Actions for CI, [Vercel](https://vercel.com) for hosting

## Running locally

You need Node.js 24, [pnpm](https://pnpm.io) 11 and [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for the local Supabase stack).

```bash
pnpm install
pnpm supabase start
pnpm env:local
pnpm dev
```

Then open http://localhost:3100. `pnpm env:local` writes the local Supabase URL and keys into `.env.local` (see `.env.example` for every variable), and sets `EMBEDDING_MODEL=offline`, a word-matching stand-in that needs no API key. For real semantic search, set `EMBEDDING_MODEL=cohere/embed-v4.0` and an `AI_GATEWAY_API_KEY` from the [Vercel AI Gateway](https://vercel.com/ai-gateway), then re-index on the Knowledge tab. `CHAT_MODEL` works the same way: `offline` (answers from the knowledge base, and books from one exact request) or `openai/gpt-5-mini`. Both are on the gateway's free tier ($5 of credit every 30 days, for a subset of models; Claude and OpenAI's embeddings need paid credit), which covers local use and the evaluation suite. The test suites always use the offline models, whatever `.env.local` says.

## Tests

| Suite          | Command                 | Notes                                                                                    |
| -------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| Unit           | `pnpm test`             | Vitest                                                                                   |
| Database / RLS | `pnpm test:db`          | pgTAP; needs `pnpm supabase start` first                                                 |
| Concurrency    | `pnpm test:concurrency` | Many connections booking the same slot at once; needs Supabase running                   |
| Integration    | `pnpm test:integration` | The assistant's tools and turns against the full local stack, with a scripted model      |
| End-to-end     | `pnpm test:e2e`         | Playwright with accessibility checks; first run: `pnpm exec playwright install chromium` |
| Evaluation     | `pnpm eval`             | On demand, never in CI: the real assistant, scored; reports in `evals/reports/`          |

`pnpm lint`, `pnpm typecheck` and `pnpm format:check` run in CI alongside every suite. No test calls a real AI model.

The evaluation suite runs with the models in `.env.local`, or others set for one run:

```bash
CHAT_MODEL=openai/gpt-5-mini EMBEDDING_MODEL=cohere/embed-v4.0 pnpm eval
```

A full run costs about $0.10 on GPT-5 mini, inside the AI Gateway's free monthly credit. `EVAL_BUDGET_USD` (default 1.50) stops it from starting new cases past that amount, `EVAL_CASES=en-parking,ar-hours` runs only those cases, and `EVAL_JUDGE_MODEL=off` skips the judge.

## Evaluation results

The suite chose the default models. The AI Gateway's free tier covers neither Claude nor OpenAI's embeddings, so these are the free-tier candidates, run on 2026-10-05 against the same 24 conversations with Cohere embed-v4.0 for search and GPT-5 mini as the judge (GPT-5 mini's own result was cross-checked with Gemini as the judge):

| Chat model                | Cases passed | Cost of a run | Median call | Slowest 5% of calls |
| ------------------------- | ------------ | ------------- | ----------- | ------------------- |
| GPT-5 mini, low reasoning | 24 / 24      | $0.085        | 4.2 s       | 25.6 s              |
| GPT-4.1 mini              | 21 / 24      | $0.097        | 2.0 s       | 10.7 s              |
| Gemini 2.5 Flash          | 21 / 24      | $0.073        | 1.6 s       | 17.9 s              |

GPT-5 mini is the default: the most careful, at the price of slower replies. The first runs found real problems, fixed since: replies in the wrong language, missing citations, an injected document's "everything is free" repeated as fact, a model writing "no charge" into a booking's note for staff to read, "we don't offer that" invented from missing information, and a handover promised but never made. Search uses Cohere with a 0.3 relevance threshold, from the retrieval report (the right passage ranked first for all 13 answerable questions).

## Roadmap

- [x] **Phase 0:** project setup, test tooling and CI
- [x] **Phase 1:** tenants, auth and business setup (services, staff, hours, time off), with Row-Level Security
- [x] **Phase 2:** booking engine: availability, the exclusion constraint, idempotent booking
- [x] **Phase 3:** knowledge base and retrieval with pgvector
- [x] **Phase 4:** the assistant: streaming chat, tools, grounding, confirmation flow, injection resistance
- [x] **Phase 5:** embeddable widget and staff inbox
- [ ] **Phase 6:** evaluation suite, end-to-end flows, usage dashboard
- [ ] **Phase 7:** documentation, demo data and live demo
