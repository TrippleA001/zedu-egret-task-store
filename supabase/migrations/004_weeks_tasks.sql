-- 004_weeks_tasks.sql — Week/Task structure + customizable per-task submissions.
-- Stage numbers become GLOBAL task numbers (Task 1..N); week_number groups
-- them into Week 1 / Week 2 sections. Each product carries a submission_schema
-- (JSON array of field defs) that drives the checkout form + server validation.
-- Submissions gain a values JSONB map; legacy todo_app_url/task_repo_url
-- columns are kept + backfilled so Stage-1 tooling keeps working.
-- Run in Supabase SQL editor (after 003_cart.sql).

-- 1. Products: week grouping + submission schema.
alter table public.products
  add column if not exists week_number int not null default 1;
alter table public.products
  add column if not exists submission_schema jsonb not null default '[]';

-- 2. Submissions: flexible values map alongside legacy columns.
alter table public.submissions
  add column if not exists values jsonb not null default '{}';

-- 3. Carts: same values map (mobile sync reads this, not the legacy cols).
alter table public.carts
  add column if not exists values jsonb not null default '{}';

-- 4. Backfill existing submissions (Task 1 era rows) into the values map.
update public.submissions
set values = jsonb_build_object(
  'deployed_url', coalesce(todo_app_url, ''),
  'github_repo', coalesce(task_repo_url, '')
)
where values = '{}'::jsonb
  and (coalesce(todo_app_url, '') <> '' or coalesce(task_repo_url, '') <> '');

-- 5. Retitle existing rows to the task naming + attach schemas.
-- Task 1 (Week 1, open): deployed site URL + public GitHub repo.
update public.products
set title = 'Task 1 Verification',
    description = 'Task 1 milestone: deploy your ToDo app and link your public GitHub repo. Zero-cost verification product.',
    week_number = 1,
    submission_schema = '[
      {"key":"deployed_url","label":"Deployed ToDo app URL","hint":"https only, must return HTTP 200.","type":"live_url","required":true},
      {"key":"github_repo","label":"Task GitHub repo URL","hint":"Public, non-empty github.com/owner/repo.","type":"github_repo","required":true}
    ]'::jsonb
where stage_number = 1;

-- Task 2 (Week 1, closed for now): deployed e-commerce site + repo.
update public.products
set title = 'Task 2 Verification',
    description = 'Task 2 milestone: deploy your e-commerce site and link your public GitHub repo. Zero-cost verification product.',
    week_number = 1,
    submission_schema = '[
      {"key":"deployed_url","label":"Deployed e-commerce site URL","hint":"https only, must return HTTP 200.","type":"live_url","required":true},
      {"key":"github_repo","label":"Task GitHub repo URL","hint":"Public, non-empty github.com/owner/repo.","type":"github_repo","required":true}
    ]'::jsonb
where stage_number = 2;

-- 6. New tasks: 3 (Week 1), 4 + 5 (Week 2, locked).
-- Task 3 example per spec: cart-sync video + APK drive links, public mobile
-- repo, and a MERGED PR link (open or closed-unmerged is rejected).
insert into public.products (title, description, price, stage_number, is_active, week_number, submission_schema)
values
  ('Task 3 Verification', 'Task 3 milestone: mobile-web cart sync video, APK, mobile repo and a merged PR. Zero-cost verification product.', 0.00, 3, true, 1, '[
    {"key":"video_drive","label":"Drive link — cart sync video","hint":"Google Drive file or folder link.","type":"drive_url","required":true},
    {"key":"apk_drive","label":"Drive link — installable APK","hint":"Google Drive link to your .apk build.","type":"drive_url","required":true},
    {"key":"mobile_repo","label":"Public GitHub repo (mobile app)","hint":"Public, non-empty github.com/owner/repo.","type":"github_repo","required":true},
    {"key":"merged_pr","label":"Merged PR link","hint":"github.com/owner/repo/pull/N — must be merged (open or closed-unmerged is rejected).","type":"github_pr","required":true}
  ]'::jsonb),
  ('Task 4 Verification', 'Task 4 milestone. Locked until Task 3 is fulfilled.', 0.00, 4, true, 2, '[
    {"key":"deployed_url","label":"Deployed app URL","hint":"https only, must return HTTP 200.","type":"live_url","required":true},
    {"key":"github_repo","label":"Task GitHub repo URL","hint":"Public, non-empty github.com/owner/repo.","type":"github_repo","required":true}
  ]'::jsonb),
  ('Task 5 Verification', 'Task 5 milestone. Locked until Task 4 is fulfilled.', 0.00, 5, true, 2, '[
    {"key":"deployed_url","label":"Deployed app URL","hint":"https only, must return HTTP 200.","type":"live_url","required":true},
    {"key":"github_repo","label":"Task GitHub repo URL","hint":"Public, non-empty github.com/owner/repo.","type":"github_repo","required":true}
  ]'::jsonb)
on conflict (stage_number) do nothing;
