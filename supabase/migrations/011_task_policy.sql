-- 011_task_policy.sql — Task policy (Phase 8).
-- Two admin-configured levers per task:
--
-- prereq_stages: free-text list/range of stage numbers ("1-10, 15, 70-90")
--   that must ALL be cleared before this task unlocks. Empty/null keeps the
--   historic default (stage N-1). Parsed server-side by lib/policy.ts.
--
-- attempts_policy: 'single' (default — one submission per member per task,
--   a re-checkout is a 409 exactly as before) or 'multiple' (every checkout
--   saves a new attempt; prior attempts stay in history with is_current =
--   false and the latest row carries the next attempt_number).
--
-- Run in Supabase SQL editor (after 010_organizations.sql).

alter table public.products
  add column if not exists prereq_stages text;

alter table public.products
  add column if not exists attempts_policy text not null default 'single'
  check (attempts_policy in ('single', 'multiple'));

-- Attempts are kept per task: the one-submission-per-(user,org,stage) rule
-- moves to per-attempt uniqueness, plus exactly-one-current per task.
drop index if exists public.submissions_user_org_stage_uq;

alter table public.submissions
  add column if not exists attempt_number int not null default 1;
alter table public.submissions
  add column if not exists is_current boolean not null default true;

create unique index if not exists submissions_attempt_uq
  on public.submissions (user_id, org_id, stage_number, attempt_number);

create unique index if not exists submissions_current_uq
  on public.submissions (user_id, org_id, stage_number) where is_current;
