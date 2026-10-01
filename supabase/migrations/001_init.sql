-- 001_init.sql — Zedu Egret Store schema (v3: workspace_email, nullable sub_team)
-- Run in Supabase SQL editor or via supabase db push.

-- Enable citext for case-insensitive emails (optional but recommended)
create extension if not exists "citext";
create extension if not exists "pgcrypto";

-- TEMPORARY roster lookup table. Safe to DROP after onboarding.
-- No other table references it (claimed_by has NO FK on purpose).
create table if not exists public.roster (
  id uuid primary key default gen_random_uuid(),
  full_name text not null,
  email citext unique not null,
  zedu_id text unique not null,
  workspace_join_email citext,
  github_url text,
  claimed_by uuid unique null,
  claimed_at timestamptz null,
  created_at timestamptz default now() not null
);
create index if not exists roster_email_idx on public.roster (email);
create index if not exists roster_unclaimed_idx on public.roster (email) where claimed_by is null;

-- Permanent intern profiles. Denormalized copy of roster fields so roster can be dropped.
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  auth_email varchar(255) not null,
  workspace_email varchar(255) unique not null,
  zedu_id varchar(50) unique not null,
  full_name varchar(255) not null,
  github_url varchar(255) not null,
  telegram_handle varchar(100) not null,
  sub_team varchar(100), -- greyed out for now, always NULL (auto-assigned later)
  skill_rating int check (skill_rating between 1 and 5),
  channels_verified boolean default false not null,
  created_at timestamptz default now() not null
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title varchar(255) not null,
  description text,
  price decimal(10,2) default 0.00 not null,
  stage_number int unique not null,
  is_active boolean default true not null,
  created_at timestamptz default now() not null
);

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete restrict,
  status varchar(50) default 'fulfilled' check (status in ('pending_verification','fulfilled','rejected')),
  order_number varchar(100) unique not null,
  created_at timestamptz default now() not null
);
create index if not exists orders_user_idx on public.orders (user_id);

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  stage_number int not null,
  todo_app_url text not null,
  task_repo_url text not null,
  verified_at timestamptz default now() not null,
  constraint unique_user_stage unique (user_id, stage_number)
);

-- Seed stage products (extensible: add stage 2,3 later as locked until prereq)
insert into public.products (title, description, price, stage_number, is_active)
values
  ('Stage 1 Verification', 'Task 1 milestone: deploy your ToDo app and link your public GitHub repo. Zero-cost verification product.', 0.00, 1, true),
  ('Stage 2 Verification', 'Task 2 milestone. Locked until Stage 1 is fulfilled.', 0.00, 2, true)
on conflict (stage_number) do nothing;

-- Row Level Security
alter table public.roster enable row level security;
alter table public.users enable row level security;
alter table public.products enable row level security;
alter table public.orders enable row level security;
alter table public.submissions enable row level security;

-- roster: deny direct client access; all reads/writes via service_role APIs.
-- (No permissive policies = locked down. The /api/roster/emails route uses service role.)
drop policy if exists "roster_no_client_access" on public.roster;

-- users: owner-only
drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users for select using (auth.uid() = id);
drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users for update using (auth.uid() = id);
-- inserts happen via service_role onboarding API (no client insert policy)

-- products: public read
drop policy if exists "products_read_all" on public.products;
create policy "products_read_all" on public.products for select using (true);

-- orders: owner-only read (writes via service_role checkout API)
drop policy if exists "orders_select_own" on public.orders;
create policy "orders_select_own" on public.orders for select using (auth.uid() = user_id);

-- submissions: owner-only read (writes via service_role checkout API)
drop policy if exists "submissions_select_own" on public.submissions;
create policy "submissions_select_own" on public.submissions for select using (auth.uid() = user_id);
