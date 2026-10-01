# Zedu Egret Store — Task Verification & Onboarding Portal

E-commerce metaphor (Catalog → Cart → Checkout → Order Receipt) where program
milestones are zero-cost products. Next.js App Router + Supabase + Mailgun.

## Quick start

```bash
cp .env.example .env.local   # fill keys (see below)
npm install
# Run supabase/migrations/001_init.sql in Supabase SQL Editor
npm run import:roster ./roster.csv
npm run dev                  # http://localhost:3000
```

## Env vars (`.env.local`, never commit)

| Var | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Same page → publishable key (`sb_publishable_...`) |
| `SUPABASE_SECRET_KEY` | Same page → secret key (`sb_secret_...`, new format) or legacy service_role JWT |
| `GITHUB_PAT` | GitHub → Settings → Developer settings → Fine-grained PAT: Repository `Contents: Read`, `Metadata: Read`, public repos |
| `MAILGUN_API_KEY` / `MAILGUN_DOMAIN` / `MAILGUN_FROM` | Mailgun → Sending → Domains / API keys (optional; skipped if placeholder) |
| `CONTRIBUTORS_WEBHOOK_URL` / `CONTRIBUTORS_WEBHOOK_TOKEN` | GitHub repo dispatches URL + PAT with `Contents: write` (optional locally) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` locally |

## Key flows

- `/login` → Google OAuth → `/auth/callback` → `/` or `/onboarding`
- `/onboarding` — Step 1: roster email dropdown + Zedu ID verify; Step 2: profile + 4 channel checkboxes; Step 3: skill 1–5 (sub-team greyed out, auto-assigned later)
- `/` — storefront: Stage 1 active ($0.00), Stage 2+ locked until prereq
- `POST /api/checkout` — HTTPS + SSRF guard, HTTP-200 app check, GitHub `!private && size>0`, duplicate guard, `ZE-2026-XXXX` order, Mailgun + webhook fire-and-forget

## Scripts

- `npm test` / `npx tsc --noEmit` / `npm run build`
- `npm run import:roster ./roster.csv` — CSV headers: `Full name,Email,Zedu username (ID),Email used to join the Zedu workspace,Github url`
- `npx tsx scripts/build-contributors.ts` — writes `public/contributors/zedu-egret/index.html` (also via GitHub Action)
