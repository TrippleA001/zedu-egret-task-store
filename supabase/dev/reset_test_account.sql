-- Reset a test account so the same Gmail can be used to test onboarding again.
--
-- Replace the email below, then run in the Supabase SQL Editor.
--
-- Why this is needed:
--   public.roster.claimed_by is a plain UUID with NO foreign key (so the roster
--   table can be dropped later). Deleting the auth user cascades to
--   users/orders/submissions/notifications, but it does NOT release the roster
--   claim. Without the UPDATE at the bottom, re-onboarding fails with
--   "This email has already been claimed".

-- 1. Inspect what will be removed
select u.id, u.auth_email, u.workspace_email, u.zedu_id, u.full_name
from public.users u
where u.workspace_email = 'REPLACE_WITH_TEST_EMAIL';

-- 2. Delete dependent rows, then the profile
with target as (
  select id from public.users where workspace_email = 'REPLACE_WITH_TEST_EMAIL'
)
delete from public.notifications where user_id in (select id from target);

with target as (
  select id from public.users where workspace_email = 'REPLACE_WITH_TEST_EMAIL'
)
delete from public.orders where user_id in (select id from target);

with target as (
  select id from public.users where workspace_email = 'REPLACE_WITH_TEST_EMAIL'
)
delete from public.submissions where user_id in (select id from target);

delete from public.users where workspace_email = 'REPLACE_WITH_TEST_EMAIL';

-- 3. Release the roster claim (NOT handled by any cascade)
update public.roster
set claimed_by = null, claimed_at = null
where email = 'REPLACE_WITH_TEST_EMAIL';

-- 4. Verify it is clean
select email, claimed_by, claimed_at
from public.roster
where email = 'REPLACE_WITH_TEST_EMAIL';