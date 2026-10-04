# Hala

[![CI](https://github.com/MostafaSaafan5517/hala/actions/workflows/ci.yml/badge.svg)](https://github.com/MostafaSaafan5517/hala/actions/workflows/ci.yml)

An AI receptionist for appointment-based businesses (salons, clinics, studios, consultants), in Arabic and English. Customers chat with it on the business's website: it answers questions from the business's own data, checks real availability, and books, reschedules or cancels appointments. Staff see every conversation and booking, and can take a conversation over.

**Status:** in development. Accounts and business setup (Phase 1) are done; the booking engine is next. See the [roadmap](#roadmap).

## What works today

- **Accounts:** sign up with email confirmation, sign in, sign out; pages that need an account send visitors to sign in and bring them back afterwards.
- **Businesses:** an owner creates a business with its own web address, time zone and the assistant's first language (English or Arabic). Each business has one owner and can have admins and staff; inviting them from the app comes with the staff inbox (Phase 5).
- **Services** with English and Arabic names, duration, buffer time and price in any common currency (stored in the currency's smallest unit; Arabic-Indic digits are accepted). Services are archived, never deleted, so past bookings keep their meaning.
- **Staff** (no account needed) and the services each one performs.
- **Working hours** for the business and, where they differ, for each staff member, with split shifts; **time off** for staff and **closures** for the whole business, entered in the business's local time and stored in UTC, daylight saving included.
- **Booking rules:** minimum notice, how far ahead customers can book, how often appointments start, and how late they can cancel.
- **An append-only audit log** of every setup change, written by database triggers; nobody, not even the server, can edit or delete it.
- **Roles enforced in the database:** owners and admins manage the setup, staff can only view it, and Row-Level Security keeps every business's data invisible to every other business. pgTAP tests cover each policy, including the refusals.

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

Then open http://localhost:3100. `pnpm env:local` writes the local Supabase URL and keys into `.env.local` (see `.env.example` for every variable).

## Tests

| Suite          | Command                 | Notes                                                                                    |
| -------------- | ----------------------- | ---------------------------------------------------------------------------------------- |
| Unit           | `pnpm test`             | Vitest                                                                                   |
| Database / RLS | `pnpm test:db`          | pgTAP; needs `pnpm supabase start` first                                                 |
| Concurrency    | `pnpm test:concurrency` | Many connections booking the same slot at once; needs Supabase running                   |
| End-to-end     | `pnpm test:e2e`         | Playwright with accessibility checks; first run: `pnpm exec playwright install chromium` |

`pnpm lint`, `pnpm typecheck` and `pnpm format:check` run in CI alongside all three suites.

## Roadmap

- [x] **Phase 0:** project setup, test tooling and CI
- [x] **Phase 1:** tenants, auth and business setup (services, staff, hours, time off), with Row-Level Security
- [ ] **Phase 2:** booking engine: availability, the exclusion constraint, idempotent booking
- [ ] **Phase 3:** knowledge base and retrieval with pgvector
- [ ] **Phase 4:** the assistant: streaming chat, tools, grounding, confirmation flow, injection resistance
- [ ] **Phase 5:** embeddable widget and staff inbox
- [ ] **Phase 6:** evaluation suite, end-to-end flows, usage dashboard
- [ ] **Phase 7:** documentation, demo data and live demo
