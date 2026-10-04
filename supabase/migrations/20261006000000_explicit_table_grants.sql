-- Explicit table privileges for the Data API roles.
-- Root cause of the production "We couldn't save your profile" failure: the earlier migrations relied on Supabase's
-- default privileges, which this project does not have, so `authenticated` held no SELECT/INSERT/UPDATE/DELETE on any
-- app table (RLS never even ran: Postgres refused first). Privileges below are the minimum each existing RLS policy
-- needs; RLS still decides which rows. Idempotent. cron_secret and reminder_log stay ungranted (security-definer only).

grant select on public.interests to anon, authenticated;
grant insert, update, delete on public.interests to authenticated;            -- interests_admin_write (is_admin())
grant select on public.admins to authenticated;                               -- admins_self_read
grant select, insert, update, delete on public.profiles to authenticated;     -- profiles_own_*
grant select, insert, update, delete on public.opportunities to authenticated; -- student read (verified) / admin all
grant select, insert, update, delete on public.student_opportunities to authenticated; -- so_own_all
grant insert on public.events to anon, authenticated;                         -- events_insert (landing views are anonymous)
grant select on public.events to authenticated;                               -- events_own_read / events_admin_read
grant select, insert, update, delete on public.opportunity_admin to authenticated; -- admin only via RLS
grant select on public.opportunity_audit to authenticated;                    -- admin only via RLS
grant select, insert, update, delete on public.match_feedback to authenticated;    -- match_feedback_own
