-- 003_reset_test_account.sql
with u as (select id from public.users where workspace_email = 'abduljaleel_abdulsamad@yahoo.com')
delete from public.notifications where user_id in (select id from u);
with u as (select id from public.users where workspace_email = 'abduljaleel_abdulsamad@yahoo.com')
delete from public.orders where user_id in (select id from u);
with u as (select id from public.users where workspace_email = 'abduljaleel_abdulsamad@yahoo.com')
delete from public.submissions where user_id in (select id from u);
delete from public.users where workspace_email = 'abduljaleel_abdulsamad@yahoo.com';
update public.roster set claimed_by = null, claimed_at = null where email = 'abduljaleel_abdulsamad@yahoo.com';
