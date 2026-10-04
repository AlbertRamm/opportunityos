-- Make ONE existing account an OpportunityOS application admin. Run in the Supabase SQL editor.
-- Scope: inserts a single row in public.admins. That row is read by public.is_admin() and only unlocks the
-- RLS policies/RPCs in this app (/admin pages, opportunity writes, events + feedback summaries). It grants NO
-- Supabase dashboard/owner access, no service_role key, and no ability to create other admins (API roles have
-- no INSERT/UPDATE/DELETE on public.admins). Requires migration 20261007 so the grant is audited.
-- Replace the email below; the statement fails (0 rows) if the account has never signed in.
insert into public.admins (user_id)
select id from auth.users where email = 'alramirez124@gmail.com'
on conflict do nothing
returning user_id, created_at;
