-- Grant admin access. Replace the email, then run in the Supabase SQL editor.
-- The person must have signed in to the app at least once so the auth user exists.
insert into public.admins (user_id)
select id from auth.users where email = 'YOU@EXAMPLE.COM'
on conflict do nothing;
