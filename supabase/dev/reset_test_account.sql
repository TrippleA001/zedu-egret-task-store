-- Reset a test account so the same Gmail can be used to test onboarding again.
--
-- Run in the Supabase SQL Editor. Edit ONLY the one line marked below — the
-- test email is declared once and reused everywhere inside the block.
--
-- Why this is needed:
--   public.roster.claimed_by is a plain UUID with NO foreign key (so the roster
--   table can be dropped later). Deleting the profile cascades to
--   orders/submissions/notifications/carts, but it does NOT release the roster
--   claim. Without the roster UPDATE, re-onboarding fails with
--   "This email has already been claimed".

do $$
declare
  -- ▼▼▼ SET THE TEST EMAIL HERE — this is the ONLY line you edit ▼▼▼
  v_email text := 'REPLACE_WITH_TEST_EMAIL';
  -- ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲ ▲▲▲

  v_uid uuid;
  v_orders int := 0;
  v_submissions int := 0;
  v_notifications int := 0;
  v_carts int := 0;
  v_roster_claimed_before boolean;
begin
  -- 0. Locate the profile (workspace_email matches roster email case-insensitively)
  select id into v_uid from public.users where workspace_email = v_email;

  if v_uid is null then
    raise notice 'STEP 0: no public.users row for % — profile already clean.', v_email;
  else
    -- 1. Count what the cascade will remove (informational)
    select count(*) into v_orders       from public.orders       where user_id = v_uid;
    select count(*) into v_submissions  from public.submissions  where user_id = v_uid;
    select count(*) into v_notifications from public.notifications where user_id = v_uid;
    select count(*) into v_carts        from public.carts        where user_id = v_uid;

    -- 2. Delete the profile. Every dependent table
    --    (orders, submissions, notifications, carts) declares
    --    `references public.users(id) on delete cascade`, so one delete is enough.
    delete from public.users where id = v_uid;
    raise notice 'STEP 1: deleted profile % (cascaded: % orders, % submissions, % notifications, % carts).',
      v_uid, v_orders, v_submissions, v_notifications, v_carts;
  end if;

  -- 3. Release the roster claim (NOT handled by any cascade — the whole point).
  select (claimed_by is not null) into v_roster_claimed_before
    from public.roster where email = v_email;

  update public.roster
     set claimed_by = null, claimed_at = null
   where email = v_email;

  if not found then
    raise notice 'STEP 2: no roster row for % — nothing to release.', v_email;
  elsif coalesce(v_roster_claimed_before, false) then
    raise notice 'STEP 2: released roster claim for %.', v_email;
  else
    raise notice 'STEP 2: roster row for % was already unclaimed.', v_email;
  end if;

  -- 4. Verify: profile gone, roster free, auth user untouched (login still works)
  if exists (select 1 from public.users where workspace_email = v_email) then
    raise notice 'VERIFY FAILED: a public.users row still exists for %.', v_email;
  else
    raise notice 'VERIFY OK: no public.users row for %.', v_email;
  end if;

  if exists (select 1 from public.roster where email = v_email and claimed_by is not null) then
    raise notice 'VERIFY FAILED: roster claim for % is still set.', v_email;
  else
    raise notice 'VERIFY OK: roster row for % is free (or absent).', v_email;
  end if;

  if exists (select 1 from auth.users where email = v_email) then
    raise notice 'NOTE: auth.users row for % still exists — login works and onboarding restarts fresh.', v_email;
  else
    raise notice 'NOTE: no auth.users row for % — the account will re-register via Google OAuth.', v_email;
  end if;
end $$;

-- Optional eyeball view: every roster claim + leftover profiles (read-only).
select r.email, r.claimed_by, r.claimed_at,
       (u.id is not null) as has_profile
from public.roster r
left join public.users u on u.id = r.claimed_by
order by r.claimed_at desc nulls last;
