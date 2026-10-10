-- 010_organizations.sql — Multi-tenancy core (Phase 7).
-- Organizations are independent tenants that can share members: a user can
-- belong to many orgs (user_orgs junction) and works inside one at a time
-- (users.active_org_id, switched instantly from /profile). Catalog, roster,
-- orders and submissions are scoped per org, so task numbering restarts per
-- org (stage_number uniqueness moves from global to per-org) and a Task 1
-- pass in one org says nothing about another.
--
-- Backfill enrolls EVERYTHING into a single 'Zedu Egret' org (slug
-- 'zedu-egret') so behavior is unchanged until a second org is created.
-- Admin membership assignment for a second org arrives in Phase 10.
-- Run in Supabase SQL editor (after 009_products_realtime.sql).

-- 1. Organizations. Roster rows gain org_id too (nullable: the CSV import
-- script writes roster directly; unassigned rows are invisible to org
-- dropdowns until an org is set).
create table if not exists public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz default now() not null
);

-- 2. Tenant columns.
alter table public.roster      add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.products    add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.orders      add column if not exists org_id uuid references public.organizations(id) on delete restrict;
alter table public.submissions add column if not exists org_id uuid references public.organizations(id) on delete restrict;

-- 3. Membership junction + the user's working org. Membership is managed by
-- service-role code only (no client insert/update/delete policies); switching
-- the active org is a service API in /profile.
create table if not exists public.user_orgs (
  user_id uuid not null references public.users(id) on delete cascade,
  org_id  uuid not null references public.organizations(id) on delete cascade,
  created_at timestamptz default now() not null,
  primary key (user_id, org_id)
);

alter table public.users
  add column if not exists active_org_id uuid references public.organizations(id) on delete set null;

-- 4. Task numbers are unique per org, not globally. Submissions likewise:
-- a member can clear the same task number once per org they belong to.
alter table public.products drop constraint if exists products_stage_number_key;
create unique index if not exists products_org_stage_uq on public.products (org_id, stage_number);

alter table public.submissions drop constraint if exists unique_user_stage;
create unique index if not exists submissions_user_org_stage_uq
  on public.submissions (user_id, org_id, stage_number);

-- 5. Backfill into the single default org (idempotent on re-run).
insert into public.organizations (name, slug)
values ('Zedu Egret', 'zedu-egret')
on conflict (slug) do nothing;

update public.products    set org_id = (select id from public.organizations where slug = 'zedu-egret') where org_id is null;
update public.orders      set org_id = (select id from public.organizations where slug = 'zedu-egret') where org_id is null;
update public.submissions set org_id = (select id from public.organizations where slug = 'zedu-egret') where org_id is null;
update public.roster      set org_id = (select id from public.organizations where slug = 'zedu-egret') where org_id is null;

insert into public.user_orgs (user_id, org_id)
select u.id, (select id from public.organizations where slug = 'zedu-egret')
from public.users u
on conflict do nothing;

update public.users
set active_org_id = (select id from public.organizations where slug = 'zedu-egret')
where active_org_id is null;

-- 6. RLS. Org list is readable by any signed-in user (onboarding dropdown,
-- profile switcher); membership rows are owner-readable. Writes stay
-- service-role only.
alter table public.organizations enable row level security;
drop policy if exists "orgs_read_authenticated" on public.organizations;
create policy "orgs_read_authenticated" on public.organizations
  for select to authenticated using (true);

alter table public.user_orgs enable row level security;
drop policy if exists "user_orgs_select_own" on public.user_orgs;
create policy "user_orgs_select_own" on public.user_orgs
  for select to authenticated using (auth.uid() = user_id);
