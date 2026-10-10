-- 012_org_rename.sql — Rebrand the default tenant for the Zedu Store rename.
-- Members see the org name in the onboarding dropdown and profile switcher,
-- so the backfilled 'Zedu Egret' org now displays as 'Zedu Store'. The slug
-- 'zedu-egret' is untouched: it is an internal identifier (lib/org.ts,
-- migrations 010/011) that never renders in the UI.
-- Run in Supabase SQL editor (after 011_task_policy.sql).

update public.organizations
set name = 'Zedu Store'
where slug = 'zedu-egret'
  and name = 'Zedu Egret';
