-- 003_cart.sql — persisted cross-device cart (web <-> mobile sync).
-- One row per onboarded user. Mobile and web both read/write this row, and both
-- subscribe to Realtime postgres_changes on it, so a cart change on one device
-- appears on the other. Conflict rule: last-write-wins on updated_at (the cart
-- holds a single product, so no merge logic is needed).
-- Run in Supabase SQL editor (after 001_init.sql, 002_notifications.sql).
create table if not exists public.carts (
  user_id uuid primary key references public.users(id) on delete cascade,
  product_id uuid not null references public.products(id) on delete cascade,
  todo_url text not null default '',
  repo_url text not null default '',
  created_at timestamptz default now() not null,
  updated_at timestamptz default now() not null
);

alter table public.carts enable row level security;

-- Owner-only access. Inserts/updates/deletes happen through the anon key from
-- web + mobile clients authenticated as the user (unlike orders/submissions,
-- the cart is client-writable by design).
drop policy if exists "carts_select_own" on public.carts;
create policy "carts_select_own" on public.carts for select using (auth.uid() = user_id);
drop policy if exists "carts_insert_own" on public.carts;
create policy "carts_insert_own" on public.carts for insert with check (auth.uid() = user_id);
drop policy if exists "carts_update_own" on public.carts;
create policy "carts_update_own" on public.carts for update using (auth.uid() = user_id);
drop policy if exists "carts_delete_own" on public.carts;
create policy "carts_delete_own" on public.carts for delete using (auth.uid() = user_id);

-- Realtime fan-out for cross-device sync. Clients subscribe with the filter
-- user_id=eq.<uid>; RLS select policy governs which events they receive.
alter publication supabase_realtime add table public.carts;
