-- 002_notifications.sql — in-account inbox (mirrors Mailgun receipt content).
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  kind varchar(50) not null default 'order_fulfilled',
  title varchar(255) not null,
  body text not null,
  order_number varchar(100),
  read_at timestamptz,
  created_at timestamptz default now() not null
);
create index if not exists notifications_user_idx on public.notifications (user_id, created_at desc);
create index if not exists notifications_unread_idx on public.notifications (user_id) where read_at is null;

alter table public.notifications enable row level security;
drop policy if exists "notifications_select_own" on public.notifications;
create policy "notifications_select_own" on public.notifications for select using (auth.uid() = user_id);
drop policy if exists "notifications_update_own" on public.notifications;
create policy "notifications_update_own" on public.notifications for update using (auth.uid() = user_id);
-- inserts happen via service_role checkout API (no client insert policy)
