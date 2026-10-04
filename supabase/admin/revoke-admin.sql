-- Undo grant-admin.sql: the account immediately stops passing is_admin() and /admin bounces it to /dashboard.
-- The revoke is also recorded in public.admin_audit.
delete from public.admins
where user_id = (select id from auth.users where email = 'alramirez124@gmail.com')
returning user_id;
