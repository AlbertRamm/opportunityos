-- First-party source registry and review history for opportunity freshness.
create table if not exists public.opportunity_sources (
  id text primary key check (id ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  name text not null check (char_length(name) between 1 and 200),
  owner text not null check (char_length(owner) between 1 and 200),
  source_url text not null unique check (source_url ~ '^https?://'),
  source_role text not null check (source_role in ('official_program','official_sponsor','official_application_portal','official_directory','discovery_only')),
  regions text[] not null default '{}',
  opportunity_types text[] not null default '{}',
  notes text not null default '',
  review_interval_days smallint not null default 30 check (review_interval_days between 1 and 365),
  last_checked_at timestamptz,
  next_review_at date,
  last_http_status smallint check (last_http_status between 100 and 599),
  last_content_hash text,
  status text not null default 'watch' check (status in ('active','watch','paused')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.opportunity_source_checks (
  id uuid primary key default gen_random_uuid(),
  source_id text not null references public.opportunity_sources(id) on delete cascade,
  checked_at timestamptz not null default now(),
  checked_by uuid references auth.users(id) on delete set null,
  outcome text not null check (outcome in ('unchanged','changed','unavailable','next_cycle_not_posted')),
  http_status smallint check (http_status between 100 and 599),
  content_hash text,
  notes text not null default ''
);

alter table public.opportunities
  add column if not exists source_id text references public.opportunity_sources(id) on delete set null;

alter table public.opportunities drop constraint if exists opportunities_opportunity_type_check;
alter table public.opportunities add constraint opportunities_opportunity_type_check
  check (opportunity_type in (
    'internship','job','summer_program','research','scholarship','apprenticeship',
    'competition','volunteering','pre_college','activity','course','other'
  ));

create index if not exists opportunity_sources_review_idx
  on public.opportunity_sources (next_review_at, status);
create index if not exists opportunity_source_checks_source_idx
  on public.opportunity_source_checks (source_id, checked_at desc);
create index if not exists opportunities_source_idx
  on public.opportunities (source_id);

alter table public.opportunity_sources enable row level security;
alter table public.opportunity_source_checks enable row level security;

drop policy if exists opportunity_sources_admin_all on public.opportunity_sources;
create policy opportunity_sources_admin_all on public.opportunity_sources
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
drop policy if exists opportunity_source_checks_admin_all on public.opportunity_source_checks;
create policy opportunity_source_checks_admin_all on public.opportunity_source_checks
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

grant select, insert, update, delete on public.opportunity_sources to authenticated;
grant select, insert, update, delete on public.opportunity_source_checks to authenticated;

drop trigger if exists opportunity_sources_updated on public.opportunity_sources;
create trigger opportunity_sources_updated
  before update on public.opportunity_sources
  for each row execute function public.set_updated_at();

-- Public browse gets only display-safe fields, and only records checked in the
-- last 30 days that still have a future application/program window.
create or replace view public.public_opportunities
with (security_barrier = true) as
select
  id, title, organization, description, application_url, source_url,
  opportunity_type, interests, min_age, max_age, min_grade, max_grade,
  schedule_period, location_name, location_city, location_state, work_mode,
  is_paid, compensation_description, application_open_date,
  application_deadline, program_start_date, program_end_date,
  last_verified_at
from public.opportunities
where verification_status = 'verified'
  and archived_at is null
  and is_sample = false
  and last_verified_at >= now() - interval '30 days'
  and (application_deadline is null or application_deadline >= current_date)
  and (program_end_date is null or program_end_date >= current_date);

revoke all on public.public_opportunities from public;
grant select on public.public_opportunities to anon, authenticated;
