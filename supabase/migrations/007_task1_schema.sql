-- Task 1's checkout form moves from a hardcoded fallback in
-- app/components/cart-drawer.tsx into this product row, so admins edit it
-- like every other task (007_task1_schema.sql — run after 006).
-- Idempotent: only fills the row when its form is missing/empty.
update public.products
set submission_schema = '[
  {"key":"deployed_url","label":"Deployed ToDo app URL","hint":"https only, must return HTTP 200.","type":"live_url","required":true},
  {"key":"github_repo","label":"Task GitHub repo URL","hint":"Public, non-empty github.com/owner/repo.","type":"github_repo","required":true}
]'::jsonb
where stage_number = 1
  and coalesce(submission_schema, '[]'::jsonb) = '[]'::jsonb;
