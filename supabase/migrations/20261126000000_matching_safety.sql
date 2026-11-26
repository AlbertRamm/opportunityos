-- Make unknown residency explicit and distinguish eligibility questions from application directions.
alter table public.opportunities
  add column if not exists residency_scope text not null default 'unknown'
    check (residency_scope in ('unknown', 'confirmed_open', 'restricted')),
  add column if not exists application_instructions text[] not null default '{}',
  add column if not exists allowed_schools text[] not null default '{}';

alter table public.opportunities
  add column if not exists cost_status text not null default 'unknown' check (cost_status in ('unknown', 'free', 'has_fee', 'not_applicable')),
  add column if not exists cost_min numeric(10,2) check (cost_min is null or cost_min >= 0),
  add column if not exists cost_max numeric(10,2) check (cost_max is null or cost_max >= 0),
  add column if not exists cost_description text not null default '';

alter table public.opportunities drop constraint if exists opportunities_cost_range_check;
alter table public.opportunities add constraint opportunities_cost_range_check
  check (cost_min is null or cost_max is null or cost_min <= cost_max);

create or replace view public.public_opportunities
with (security_barrier = true) as
select
  id, title, organization, description, application_url, source_url,
  opportunity_type, interests, min_age, max_age, min_grade, max_grade,
  schedule_period, location_name, location_city, location_state, work_mode,
  is_paid, compensation_description, application_open_date,
  application_deadline, program_start_date, program_end_date,
  last_verified_at, cost_status, cost_min, cost_max, cost_description, allowed_schools
from public.opportunities
where verification_status = 'verified'
  and archived_at is null
  and is_sample = false
  and last_verified_at >= now() - interval '30 days'
  and (application_deadline is null or application_deadline >= current_date)
  and (program_end_date is null or program_end_date >= current_date);

revoke all on public.public_opportunities from public;
grant select on public.public_opportunities to anon, authenticated;

update public.opportunities
set residency_scope = 'restricted'
where residency_scope = 'unknown'
  and (cardinality(allowed_states) > 0 or cardinality(allowed_zips) > 0 or cardinality(allowed_counties) > 0);

alter table public.match_feedback drop constraint if exists match_feedback_match_status_check;
alter table public.match_feedback add constraint match_feedback_match_status_check
  check (match_status in ('strong_match', 'likely_match', 'eligible', 'check_requirement', 'not_eligible', 'closed'));
alter table public.match_feedback
  add column if not exists reviewed_at timestamptz,
  add column if not exists reviewed_by uuid references auth.users(id) on delete set null;

alter table public.student_opportunities
  add column if not exists saved_title text,
  add column if not exists saved_organization text;

drop policy if exists match_feedback_admin_read on public.match_feedback;
create policy match_feedback_admin_read on public.match_feedback
  for select to authenticated using (public.is_admin());
drop policy if exists match_feedback_admin_update on public.match_feedback;
create policy match_feedback_admin_update on public.match_feedback
  for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Keep source review history, source state, and listing invalidation in one transaction.
create or replace function public.record_opportunity_source_check(
  p_source_id text,
  p_outcome text,
  p_http_status smallint,
  p_notes text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  source_row public.opportunity_sources%rowtype;
  cadence integer;
begin
  if public.is_admin() is distinct from true then
    raise exception 'admin access required';
  end if;
  if p_outcome not in ('unchanged', 'changed', 'unavailable', 'next_cycle_not_posted') then
    raise exception 'invalid check outcome';
  end if;
  if p_http_status is not null and (p_http_status < 100 or p_http_status > 599) then
    raise exception 'invalid HTTP status';
  end if;

  select * into strict source_row
  from public.opportunity_sources
  where id = p_source_id
  for update;

  cadence := case when p_outcome = 'unavailable' then 7 else source_row.review_interval_days end;
  insert into public.opportunity_source_checks (source_id, checked_by, outcome, http_status, notes)
  values (p_source_id, auth.uid(), p_outcome, p_http_status, left(coalesce(p_notes, ''), 2000));

  update public.opportunity_sources
  set last_checked_at = now(),
      next_review_at = current_date + cadence,
      last_http_status = p_http_status,
      status = case when p_outcome = 'unavailable' then 'paused' else 'watch' end
  where id = p_source_id;

  if p_outcome in ('changed', 'unavailable', 'next_cycle_not_posted') then
    update public.opportunities
    set last_verified_at = now() - interval '366 days'
    where source_id = p_source_id and verification_status = 'verified';
  end if;
end;
$$;

revoke all on function public.record_opportunity_source_check(text, text, smallint, text) from public;
grant execute on function public.record_opportunity_source_check(text, text, smallint, text) to authenticated;
