-- The open/closed checkout gate moves out of lib/store.ts (TASK_OPEN map)
-- into the products table, so admins toggle it from /admin (008_task_open.sql
-- — run after 007). Backfill mirrors the code map: tasks 1-5 open, anything
-- else closed-by-default.
alter table public.products add column if not exists is_open boolean not null default false;

update public.products set is_open = true where stage_number <= 5;
