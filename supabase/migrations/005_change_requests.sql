-- 005_change_requests.sql — Profile change-request queue.
-- Users propose edits to onboarding details from /profile; leads approve or
-- reject (approval UI lands with the admin phase — until then decisions are
-- made by SQL update on status). The users row itself is still only edited
-- via service role, so a request never mutates anything by itself.
-- Run in Supabase SQL editor (after 004_weeks_tasks.sql).

create table if not exists public.change_requests (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  field text not null,
  old_value text not null default '',
  new_value text not null,
  note text not null default '',
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index if not exists change_requests_user_idx on public.change_requests (user_id, status);

alter table public.change_requests enable row level security;

-- Owner-only read (the /profile page lists own requests + pending badges).
-- Inserts and status decisions happen via service-role API — no client
-- insert/update policies on purpose.
drop policy if exists "change_requests_select_own" on public.change_requests;
create policy "change_requests_select_own" on public.change_requests
  for select using (auth.uid() = user_id);
