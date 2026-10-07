# AGENTS.md — Zedu Egret Store

Instructions for AI coding agents working in `task_commerce/`
(Next.js 14 App Router, React 18, TypeScript, Supabase, npm).

**Read [`PRD.md`](./PRD.md) for product intent and [`README.md`](./README.md) for
setup/runbook. This file is the agent working guide: layout, commands,
conventions, and the cart-sync architecture. Where the two disagree,
`PRD.md` wins on product; this file wins on workflow.**

## Hard rules

- Work on a ticket branch in the contributor's fork. Never push to
  `dev`/`central-staging`/`staging`/`main` directly; PRs go into
  `zedu-hng/<repo>:dev`. One ticket = one branch = one PR = one author.
- Keep the change to what the ticket asks. No drive-by refactors, renames,
  or dependency bumps.
- One logical change per PR, at most ~400 lines of meaningful code
  (lockfiles and generated output don't count). The app must still work
  after it merges.
- Don't edit protected files (`.github/`, tooling config, this file) without
  reviewer agreement. Full list follows the bootcamp `CONTRIBUTING.md` pattern.
- Never commit `.env`, `.env.local`, `*.pem`, credential JSON, `roster.csv`,
  or files over 1 MB (see `.gitignore` — all covered).
- Never hardcode public config beyond what `NEXT_PUBLIC_*` already carries.
  Secrets (`SUPABASE_SECRET_KEY`, `GITHUB_PAT`, Mailgun keys) stay
  server-side only — never in browser code, logs, or commits.
- Never put full `https://…` profile links in contributor-adjacent data where
  a username suffices (review-bot `hardcodedUrls` rule).

## Layout

| Path | Holds |
|---|---|
| `app/page.tsx` | Storefront (catalog grid, cart state via `useCart`, checkout call) |
| `app/components/cart-drawer.tsx` | Cart/checkout drawer (dumb UI: product + URLs + buttons) |
| `app/components/success-panel.tsx`, `site-header.tsx`, `ui.tsx` | Receipt panel, header, shared primitives |
| `app/login/`, `app/onboarding/`, `app/contributors/` | Auth entry, 3-step wizard, contributor listing |
| `app/auth/callback/` | Supabase OAuth callback route |
| `app/api/checkout|products|orders|notifications|onboarding/*|roster/emails/` | API routes — validation + writes live here |
| `lib/api-auth.ts` | Shared auth: cookie session first, then Bearer token |
| `lib/use-cart.ts` | Cross-device cart hook: Supabase row + Realtime subscription |
| `lib/store.ts` | `STAGE_OPEN` availability map + `isStagePurchasable()` |
| `lib/validation.ts` | Pure validators (URLs, GitHub, roster fields) — safe to share with mobile |
| `lib/supabase-client.ts`, `lib/supabase-server.ts` | Browser + server Supabase clients |
| `lib/side-effects.ts`, `lib/constants.ts` | Mailgun, webhooks, timeouts, shared constants |
| `supabase/migrations/00N_*.sql` | Run **in order** in Supabase SQL Editor (`003_cart.sql` after `002`) |
| `scripts/` | `import-roster.ts`, `build-contributors.ts`, `publish-contributors.ts` (tsx) |
| `test/*.test.ts` | Node tests via `tsx --test` |

## Commands

```sh
npm install          # deps (npm only — no pnpm/yarn files in this repo)
npm run dev          # next dev → http://localhost:3000
npx tsc --noEmit     # typecheck
npm test             # tsx --test test/*.test.ts
npm run build        # production build
npm run import:roster ./roster.csv
npm run preview:contributors   # local HTML preview only
npm run publish:contributors -- --dry-run
```

`.env.local` never committed. Run gates (types + tests + build) before
declaring a change done. If standalone `tsc --noEmit` fails only on stale
`.next/types/**` paths, run `npm run build` once to regenerate them, then
re-run tsc.

## Conventions

- **Imports:** `@/` alias (maps to repo root). Server-only secrets via
  `process.env.*` inside API routes; public config via `NEXT_PUBLIC_*`.
- **Auth on API routes:** always through `lib/api-auth.ts`
  (`authUser`/`authUserId` + `serviceClient()`). Cookie session is tried
  first (web), then `Authorization: Bearer` (mobile). Never read a raw
  `userId` from the body as identity — every route compares the resolved
  user id against the body value (`userId mismatch` → 403).
- **Service role:** all privileged DB access via `serviceClient()` from
  `lib/api-auth.ts` (legacy `supabaseService()` in `supabase-server.ts`
  still works). Anon-key clients never write outside RLS policies.
- **Checkout flow order** (`app/api/checkout/route.ts`): auth → field
  presence → https + SSRF checks → GitHub parse → product/stage match →
  purchasable gate (423) → prereq + duplicate guards → live HTTP-200 check
  (2 s) → GitHub API check → insert submission → insert order (retry on
  order-number collision) → notification + email + contributors webhook.
  Keep this order when editing; each guard's status code is contractual.
- **Stage gating:** `STAGE_OPEN` in `lib/store.ts` is the single source for
  "purchasable". Server enforces it (423 + `STAGE2_CLOSED_MSG`); web mirrors
  it for button state. To open a stage, flip the map + redeploy.
- **Cart:** source of truth = `public.carts` row (see section below). Never
  reintroduce ephemeral-only cart state.
- **Formatting:** Prettier defaults (double quotes, semicolons). Unused
  imports/variables fail `tsc --noEmit` — fix them, don't suppress.
- **Migrations:** new `supabase/migrations/00N_*.sql` files must be
  idempotent (`if not exists`) and listed in `README.md` run order.

## Cart sync architecture (Phase 0)

```
web (useCart) <--> public.carts row <--> mobile app (same table)
                       |  Realtime postgres_changes
                /api/checkout (validates; client clears cart after success)
```

- Table: `user_id` PK → `users.id` cascade; `product_id` → `products.id`
  cascade; `todo_url`, `repo_url`, `updated_at`. RLS: owner-only
  select/insert/update/delete (client-writable **by design** — unique
  among tables).
- Realtime publication `supabase_realtime` includes `carts`; clients
  subscribe channel `cart:<uid>` filtered `user_id=eq.<uid>`.
- Protocol: upsert on change (URL typing debounced 600 ms), last-write-wins
  on `updated_at`; DELETE row on checkout/Remove → remote side clears.
  Failed writes/deletes mark a dirty flag and are retried on the browser
  `online` event (push local changes first, else pull the row); a
  visibility-change re-read covers sleep gaps.
- Offline UX: checkout with no connection shows "You're offline. Check your
  internet connection and try again." (never raw `Failed to fetch`).
- Drawer UX: close = minimize (row persists); floating chip reopens;
  "Remove from cart" deletes the row everywhere.
- Mobile contract: replicate this exact protocol against the same table —
  full spec in [`MOBILE_HANDOVER.md`](./MOBILE_HANDOVER.md).

## Notes

- Google OAuth only; onboarding claims a pre-imported `roster` row
  (verify → claim → insert `users`). Roster is service-role only — no
  client RLS policies on purpose.
- `notifications` is the in-account inbox (Mailgun is best-effort).
- Contributors page is built externally (Action → staging frontend repo);
  `public/contributors/` output is gitignored.
- `import.log`, `tsconfig.tsbuildinfo`, `.next/` are local artifacts —
  never commit.

## Legacy architecture diagram (from v1.0 PRD — unchanged data flow)

```
+-----------------------------------------------------------------------+
|                             USER BROWSER                              |
+-----------------------------------┬-----------------------------------+
                                    |
                       1. Google OAuth / Auth Flow
                                    |
                                    v
+-----------------------------------------------------------------------+
|                    NEXT.JS FRONTEND & API ROUTES                      |
|                                                                       |
|  - Onboarding Wizard (First-time users)                               |
|  - Storefront Catalog (Zero-cost milestone products)                  |
|  - Cart & Checkout Modal                                              |
|  - Pre-flight Validation API (URL & Repo Reachability Checks)         |
+----------------─┬───────────────────────────────────┬-----------------+
                  |                                   |
    2. Read/Write | Data               3. Webhook     | 4. Dispatch Email
                  v                       Trigger     v
+-----------------------------------+   +-------------------------------+
|     SUPABASE POSTGRESQL + AUTH    |   |    MAILGUN / GCP INFRA        |
|                                   |   |                               |
|  - users      - products          |   |  - Sends order receipts &     |
|  - orders     - submissions       |   |    task fulfillment updates   |
+-----------------------------------+   +-------------------------------+
                                                      ^
                                                      |
                                        5. Commit     |
+-----------------------------------------------------+-----------------+
|                      GITHUB ACTIONS AUTOMATION WORKFLOW               |
|                                                                       |
|  - Triggered via Webhook on verified order creation                   |
|  - Queries Supabase for all verified contributors                     |
|  - Generates `public/contributors/zedu-egret/index.html`              |
|  - Auto-commits static file back to staging repository                |
+-----------------------------------------------------------------------+

```

## 3. Detailed Data Model & Database Schema

### 3.1 Table: `users`

Tracks intern profiles, identity mapping, and social setup checkpoints.

```
CREATE TABLE users (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email VARCHAR(255) UNIQUE NOT NULL,
  zedu_id VARCHAR(50) UNIQUE NOT NULL,
  full_name VARCHAR(255) NOT NULL,
  github_url VARCHAR(255) NOT NULL,
  telegram_handle VARCHAR(100) NOT NULL,
  sub_team VARCHAR(100) NOT NULL,
  skill_rating INT CHECK (skill_rating BETWEEN 1 AND 5),
  channels_verified BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

```

### 3.2 Table: `products`

Defines the store catalog representing program milestones.

```
CREATE TABLE products (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title VARCHAR(255) NOT NULL,
  description TEXT,
  price DECIMAL(10,2) DEFAULT 0.00 NOT NULL,
  stage_number INT UNIQUE NOT NULL,
  is_active BOOLEAN DEFAULT TRUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

```

### 3.3 Table: `orders`

Acts as transaction headers for task checkout requests.

```
CREATE TABLE orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  product_id UUID NOT NULL REFERENCES products(id) ON DELETE RESTRICT,
  status VARCHAR(50) DEFAULT 'fulfilled' CHECK (status IN ('pending_verification', 'fulfilled', 'rejected')),
  order_number VARCHAR(100) UNIQUE NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

```

### 3.4 Table: `submissions`

Stores granular task submission URLs submitted during checkout.

```
CREATE TABLE submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stage_number INT NOT NULL,
  todo_app_url TEXT NOT NULL,
  task_repo_url TEXT NOT NULL,
  verified_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  CONSTRAINT unique_user_stage UNIQUE (user_id, stage_number)
);

```

## 4. Feature Specifications & Requirements

### 4.1 Onboarding Wizard (First-Time Login)

* **Trigger:** User completes Google OAuth login and no matching row exists in `public.users`.

* **Step 1: Identity Confirmation**

  * Email selector pre-populated from logged-in session.

  * Zedu ID text input (required) must match expected Zedu ID to continue.

* **Step 2: Profile & Community Checkpoints**

  * Full Name and GitHub profile URL inputs fetched from a table and allow editing .

  * Telegram handle input.

  * Explicit checkboxes for mandatory channels (Telegram Announcement, Group Chat, Zedu Main, Zedu Team) along with the links to each of the channels .

* **Step 3: Sub-Team & Skills**

  * Sub-team dropdown selection.

  * Technical skill rating (1–5 star selection).

### 4.2 Storefront & Catalog

* Renders products from `public.products`.

* Stage 1 Verification Product: Active, priced at \$0.00.

* Stage 2+ Products: Visually disabled/locked until prerequisites are fulfilled.

### 4.3 Checkout & Pre-Flight Validation API

* **Endpoint:** `POST /api/checkout`

* **Inputs:** `userId`, `productId`, `stageNumber`, `todoAppUrl`, `taskRepoUrl`.

* **Validation Rules:**

  1. **Deployed App Reachability:** Perform an HTTP request to `todoAppUrl`. Reject if response code is not 200.

  2. **GitHub Repository Check:** Call GitHub REST API (`https://api.github.com/repos/{owner}/{repo}`) using a server-side PAT. Reject if 404, private, or repository size is `0`.

  3. **Duplicate Prevention:** Ensure user hasn't already submitted for this `stage_number`.

* **Order Processing:**

  1. Insert row into `submissions`.

  2. Create order record in `orders` with generated receipt ID (`ZE-2026-XXXX`).

  3. Dispatch confirmation email via Mailgun.

  4. Trigger GitHub Action webhook to generate static contributor page.

## 5. Security & Compliance

* **Row Level Security (RLS):** Enabled on all Supabase tables. Users can only read/update their own profile, submissions, and order headers.

* **Input Sanitization:** Sanitize string inputs (`full_name`, `github_url`, `telegram_handle`) before generating static HTML to eliminate Reflected/Stored Cross-Site Scripting (XSS).

* **Environment Secrets:** GitHub PATs, Supabase Service Role keys, and Mailgun API keys must remain strictly in server-side environment variables.

## 6. Non-Functional Requirements

* **Performance:** Pre-flight link validation API must respond within < 2.5 seconds.

* **Concurrency:** Static page compilation runs asynchronously via GitHub Actions to prevent Git merge lock collisions (`409 Conflicts`).

* **Availability:** Hosted on Vercel or GCP Cloud Run with zero-downtime deployment.