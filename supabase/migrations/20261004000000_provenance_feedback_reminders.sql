-- V0.2: auditable data entry, "Not a good match?" feedback, deadline reminders.
-- Apply after 20261003000000. Idempotent: safe to run more than once.

-- ================================================================ 1. provenance + audit (admin-only)
-- Evidence lives in its own admin-only table so students can never read it (opportunities is student-readable).
create table if not exists public.opportunity_admin (
  opportunity_id  uuid primary key references public.opportunities(id) on delete cascade,
  import_batch    text,                          -- e.g. '2026-10-dmv-batch-1'; null = hand-entered
  source_evidence jsonb not null default '{}'::jsonb check (pg_column_size(source_evidence) < 65536),
                                                 -- { "application_deadline": { "quote": "...", "url": "https://..." }, ... }
  review_notes    text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
drop trigger if exists opportunity_admin_updated on public.opportunity_admin;
create trigger opportunity_admin_updated before update on public.opportunity_admin
  for each row execute function public.set_updated_at();
alter table public.opportunity_admin enable row level security;
drop policy if exists opportunity_admin_all on public.opportunity_admin;
create policy opportunity_admin_all on public.opportunity_admin for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Every change to an opportunity is recorded: who, when, what changed.
create table if not exists public.opportunity_audit (
  id             bigint generated always as identity primary key,
  opportunity_id uuid not null,                  -- no FK: keep history even if a row is deleted
  changed_at     timestamptz not null default now(),
  changed_by     uuid,
  action         text not null check (action in ('insert','update','delete')),
  old_row        jsonb,
  new_row        jsonb
);
create index if not exists opportunity_audit_opp_idx on public.opportunity_audit (opportunity_id, changed_at desc);
alter table public.opportunity_audit enable row level security;
drop policy if exists opportunity_audit_read on public.opportunity_audit;
create policy opportunity_audit_read on public.opportunity_audit for select to authenticated using (public.is_admin());
-- no insert/update/delete policies: only the trigger (security definer) writes

create or replace function public.audit_opportunity() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    insert into public.opportunity_audit (opportunity_id, changed_by, action, new_row)
      values (new.id, auth.uid(), 'insert', to_jsonb(new));
    return new;
  elsif tg_op = 'UPDATE' then
    if to_jsonb(new) - 'updated_at' is distinct from to_jsonb(old) - 'updated_at' then
      insert into public.opportunity_audit (opportunity_id, changed_by, action, old_row, new_row)
        values (new.id, auth.uid(), 'update', to_jsonb(old), to_jsonb(new));
    end if;
    return new;
  else
    insert into public.opportunity_audit (opportunity_id, changed_by, action, old_row)
      values (old.id, auth.uid(), 'delete', to_jsonb(old));
    return old;
  end if;
end $$;
drop trigger if exists opportunities_audit on public.opportunities;
create trigger opportunities_audit after insert or update or delete on public.opportunities
  for each row execute function public.audit_opportunity();

-- ================================================================ 2. match feedback
create table if not exists public.match_feedback (
  user_id         uuid not null references auth.users(id) on delete cascade,
  opportunity_id  uuid not null references public.opportunities(id) on delete cascade,
  reason          text not null check (reason in
    ('topic','type','too_far','pay','timing','eligibility_wrong','info_outdated','other')),
  match_status    text not null check (match_status in ('strong_match','eligible','check_requirement','not_eligible')),
  created_at      timestamptz not null default now(),
  primary key (user_id, opportunity_id)         -- one answer per student per opportunity; changing it replaces it
);
alter table public.match_feedback enable row level security;
-- No free text anywhere in this table, by design (minors: no accidental PII).
drop policy if exists match_feedback_own on public.match_feedback;
create policy match_feedback_own on public.match_feedback for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

alter table public.events drop constraint if exists events_event_name_check;
alter table public.events add constraint events_event_name_check check (event_name in (
  'landing_page_view','onboarding_started','onboarding_completed','opportunity_viewed',
  'opportunity_saved','opportunity_unsaved','application_link_clicked',
  'opportunity_status_changed','return_session','match_feedback_submitted'));

-- Aggregates only. Per-opportunity counts are suppressed until at least 3 different students have answered,
-- and no user ids are ever returned. Admin accounts are excluded.
create or replace function public.admin_feedback_summary() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with f as (
    select m.* from public.match_feedback m
    where not exists (select 1 from public.admins a where a.user_id = m.user_id)
  ), per_opp as (
    select f.opportunity_id, count(*) as n, count(distinct user_id) as students
    from f group by 1
  )
  select jsonb_build_object(
    'total', (select count(*) from f),
    'students', (select count(distinct user_id) from f),
    'by_reason', coalesce((select jsonb_object_agg(reason, n) from (select reason, count(*) n from f group by 1) x), '{}'::jsonb),
    'by_match_status', coalesce((select jsonb_object_agg(match_status, n) from (select match_status, count(*) n from f group by 1) x), '{}'::jsonb),
    'by_opportunity', coalesce((
      select jsonb_agg(jsonb_build_object('opportunity_id', p.opportunity_id, 'title', o.title, 'count', p.n,
          'eligibility_wrong', (select count(*) from f where f.opportunity_id = p.opportunity_id and reason = 'eligibility_wrong'),
          'info_outdated',     (select count(*) from f where f.opportunity_id = p.opportunity_id and reason = 'info_outdated'))
        order by p.n desc)
      from per_opp p join public.opportunities o on o.id = p.opportunity_id
      where p.students >= 3), '[]'::jsonb),
    'suppressed_opportunities', (select count(*) from per_opp where students < 3)
  ) into r;
  return r;
end $$;
revoke all on function public.admin_feedback_summary() from public, anon;
grant execute on function public.admin_feedback_summary() to authenticated;

-- ================================================================ 3. deadline reminders
alter table public.profiles add column if not exists email_reminders boolean not null default true;

-- Shared secret between the cron route and the database. Only its SHA-256 is stored. No policies = unreadable via the API.
create table if not exists public.cron_secret (
  id          int primary key check (id = 1),
  secret_hash text not null
);
alter table public.cron_secret enable row level security;

create table if not exists public.reminder_log (
  id             bigint generated always as identity primary key,
  user_id        uuid not null references auth.users(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  kind           text not null check (kind in ('7d','2d')),
  deadline       date not null,
  status         text not null default 'pending' check (status in ('pending','sent','failed')),
  attempts       int  not null default 1,
  created_at     timestamptz not null default now(),
  sent_at        timestamptz,
  unique (user_id, opportunity_id, kind, deadline)       -- the idempotency key: one email per student/opportunity/kind/deadline
);
alter table public.reminder_log enable row level security;  -- no policies: students and admins read it only through functions

create or replace function public._cron_ok(p_secret text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.cron_secret
    where id = 1 and secret_hash = encode(sha256(convert_to(coalesce(p_secret, ''), 'UTF8')), 'hex')
  );
$$;
revoke all on function public._cron_ok(text) from public, anon, authenticated;

-- Atomically CLAIMS due reminders (inserting the log row) and returns them. A second call the same day returns nothing.
-- Rules: only verified, non-archived listings with a future deadline; only saved opportunities the student hasn't
-- applied to / dropped; only students who haven't opted out; the 7-day mail is skipped if the student saved it
-- after that window opened, and if the 2-day window is already due only the 2-day mail is sent.
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

create or replace function public.confirm_reminder(p_secret text, p_log_id bigint, p_ok boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public._cron_ok(p_secret) then raise exception 'forbidden' using errcode = '42501'; end if;
  if p_ok then
    update public.reminder_log set status = 'sent', sent_at = now() where id = p_log_id;
  else
    update public.reminder_log set status = case when attempts >= 3 then 'failed' else 'pending' end where id = p_log_id;
  end if;
end $$;

create or replace function public.unsubscribe_reminders(p_secret text, p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not public._cron_ok(p_secret) then raise exception 'forbidden' using errcode = '42501'; end if;
  update public.profiles set email_reminders = false where user_id = p_user;
end $$;

revoke all on function public.claim_due_reminders(text, date), public.confirm_reminder(text, bigint, boolean),
  public.unsubscribe_reminders(text, uuid) from public;
grant execute on function public.claim_due_reminders(text, date), public.confirm_reminder(text, bigint, boolean),
  public.unsubscribe_reminders(text, uuid) to anon, authenticated;
