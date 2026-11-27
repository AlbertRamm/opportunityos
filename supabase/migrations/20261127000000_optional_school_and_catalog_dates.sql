begin;

alter table public.profiles drop constraint if exists profiles_school_name_check;
alter table public.profiles add constraint profiles_school_name_check
  check (char_length(school_name) <= 120);

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
  and (last_verified_at at time zone 'America/New_York')::date >=
      (now() at time zone 'America/New_York')::date - 30
  and (application_deadline is null or application_deadline >= (now() at time zone 'America/New_York')::date)
  and (program_end_date is null or program_end_date >= (now() at time zone 'America/New_York')::date);

commit;
