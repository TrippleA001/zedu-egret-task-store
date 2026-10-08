-- 006_admin_roles.sql — Admin role for the /admin console.
-- Adds users.role ('member' | 'admin'). Admins are promoted manually in the
-- SQL editor (no UI on purpose):
--   update public.users set role='admin' where workspace_email='lead@example.com';
-- The owner-only client UPDATE policy is dropped: with a role column on the
-- table it would let any member set role='admin' directly via the public
-- REST API. All profile writes already go through service-role APIs
-- (onboarding insert, checkout, change-request approval), so nothing loses
-- client functionality. Run after 005_change_requests.sql.

alter table public.users
  add column if not exists role text not null default 'member';

alter table public.users drop constraint if exists users_role_check;
alter table public.users
  add constraint users_role_check check (role in ('member', 'admin'));

drop policy if exists "users_update_own" on public.users;

-- Queue query for the admin console lists pending requests first.
create index if not exists change_requests_status_idx
  on public.change_requests (status, created_at desc);
