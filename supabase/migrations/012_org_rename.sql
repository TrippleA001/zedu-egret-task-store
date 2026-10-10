-- 012_org_rename.sql — Rename the default tenant's display name to 'Team Egret'.
-- Members see the org name in the onboarding dropdown and profile switcher
-- ("Team Egret"); more orgs follow the same "Team X" pattern (e.g. Team Neo,
-- slug 'zedu-neo'). The slug 'zedu-egret' is untouched: it is an internal
-- identifier (lib/org.ts, migrations 010/011) that never renders in the UI.
-- Run in Supabase SQL editor (after 011_task_policy.sql).

update public.organizations
set name = 'Team Egret'
where slug = 'zedu-egret'
  and name = 'Zedu Egret';
