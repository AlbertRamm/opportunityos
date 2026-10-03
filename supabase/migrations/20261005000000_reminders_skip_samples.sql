-- Reminders must never be sent for fictional SAMPLE listings (a student who saved one would get a real email about a
-- fake program). Same signature as 20261004, so CREATE OR REPLACE keeps existing grants. Idempotent. Does not touch data.
create or replace function public.claim_due_reminders(p_secret text, p_today date)
returns table (log_id bigint, user_id uuid, email text, first_name text, opportunity_id uuid,
               title text, organization text, deadline date, kind text, days_left int)
language plpgsql security definer set search_path = '' as $$
#variable_conflict use_column
begin
  if not public._cron_ok(p_secret) then raise exception 'forbidden' using errcode = '42501'; end if;

  -- give up on sends that never confirmed after 3 attempts
  update public.reminder_log l set status = 'failed'
   where l.status = 'pending' and l.attempts >= 3 and l.created_at < now() - interval '30 minutes';
  -- retry previously claimed-but-unconfirmed sends (crashed run), at most 3 attempts total
  update public.reminder_log l set attempts = l.attempts + 1, created_at = now()
   where l.status = 'pending' and l.attempts < 3 and l.created_at < now() - interval '30 minutes';

  return query
  with due as (
    select so.user_id, so.opportunity_id, o.application_deadline as dl, k.kind, k.n,
           (o.application_deadline - p_today) as left_days
    from public.student_opportunities so
    join public.profiles p on p.user_id = so.user_id and p.email_reminders and p.onboarding_completed_at is not null
    join public.opportunities o on o.id = so.opportunity_id
         and o.verification_status = 'verified' and o.archived_at is null and o.application_deadline is not null
         and not o.is_sample
    cross join (values ('7d', 7), ('2d', 2)) as k(kind, n)
    where so.saved_at is not null
      and (so.status is null or so.status = 'planning')
      and o.application_deadline >= p_today
      and (o.application_deadline - p_today) <= k.n
      and (so.saved_at at time zone 'America/New_York')::date < o.application_deadline - k.n
      and not (k.kind = '7d' and (o.application_deadline - p_today) <= 2)
  ), ins as (
    insert into public.reminder_log as l (user_id, opportunity_id, kind, deadline)
    select d.user_id, d.opportunity_id, d.kind, d.dl from due d
    on conflict (user_id, opportunity_id, kind, deadline) do nothing
    returning l.id, l.user_id, l.opportunity_id, l.kind, l.deadline
  ), retry as (
    select l.id, l.user_id, l.opportunity_id, l.kind, l.deadline from public.reminder_log l
    join due d on d.user_id = l.user_id and d.opportunity_id = l.opportunity_id and d.kind = l.kind and d.dl = l.deadline
    where l.status = 'pending' and l.attempts > 1 and l.created_at >= now() - interval '1 minute'
  ), todo as (
    select * from ins union select * from retry
  )
  select t.id, t.user_id, u.email::text, p.first_name, t.opportunity_id, o.title, o.organization, t.deadline, t.kind,
         (t.deadline - p_today)::int
  from todo t
  join auth.users u on u.id = t.user_id
  join public.profiles p on p.user_id = t.user_id
  join public.opportunities o on o.id = t.opportunity_id;
end $$;
