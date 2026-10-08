-- 009_products_realtime.sql — live catalog updates on the storefront.
-- Adds products to the Realtime publication so every signed-in client
-- (web + mobile) receives postgres_changes events and refetches the catalog
-- the moment a lead edits a task (title, schema, is_open, is_active) from
-- /admin or SQL — no reload needed. Guarded so re-running is a no-op.
-- Run in Supabase SQL editor (after 008_task_open.sql).
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'products'
  ) then
    alter publication supabase_realtime add table public.products;
  end if;
end $$;
