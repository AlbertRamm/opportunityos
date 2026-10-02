-- OpportunityOS V0 schema. Run once (see README). All access is via RLS; the app never uses the service-role key.

-- ---------------------------------------------------------------- reference data
create table public.interests (
  slug        text primary key check (slug ~ '^[a-z0-9_]+$'),
  label       text not null,
  sort_order  int  not null default 0,
  active      boolean not null default true
);

insert into public.interests (slug, label, sort_order) values
  ('electrical_engineering', 'Electrical Engineering', 10),
  ('computer_engineering',   'Computer Engineering',   20),
  ('computer_science',       'Computer Science',       30),
  ('semiconductors',         'Semiconductor / Chips',  40),
  ('mechanical_engineering', 'Mechanical Engineering', 50),
  ('civil_engineering',      'Civil Engineering',      60),
  ('aerospace',              'Aerospace',              70),
  ('biology_medicine',       'Biology / Medicine',     80),
  ('chemistry',              'Chemistry',              90),
  ('environment_climate',    'Environmental / Climate',100),
  ('business',               'Business',              110),
  ('finance',                'Finance',               120),
  ('government_policy',      'Government / Public Policy', 130),
  ('arts_design',            'Arts / Design',         140),
  ('education',              'Education',             150),
  ('other',                  'Other',                 999);

-- ---------------------------------------------------------------- admins
create table public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

-- ---------------------------------------------------------------- profiles
-- Email lives in auth.users. We deliberately store no street address, no demographics.
create table public.profiles (
  user_id                 uuid primary key references auth.users(id) on delete cascade,
  first_name              text not null check (char_length(first_name) between 1 and 60),
  birth_date              date not null,
  grade                   smallint not null check (grade between 9 and 12),
  graduation_year         smallint not null check (graduation_year between 2020 and 2100),
  zip                     text not null check (zip ~ '^[0-9]{5}$'),
  state                   text not null check (state in ('DC','MD','VA','OTHER')),
  school_name             text not null check (char_length(school_name) between 1 and 120),
  -- coarse (2 decimal places ≈ 1 km) ZIP centroid, used only for distance; null if geocoding failed
  lat                     numeric(6,2),
  lng                     numeric(6,2),
  interests               text[] not null default '{}',
  opportunity_types       text[] not null default '{}',
  pay_preference          text not null check (pay_preference in ('paid_only','prefer_paid','either')),
  work_mode_preference    text not null check (work_mode_preference in ('in_person','remote','either')),
  max_travel_miles        smallint not null check (max_travel_miles in (5,10,25,50)), -- 50 means "50+"
  available_school_year   boolean not null,
  available_summer        boolean not null,
  onboarding_completed_at timestamptz,
  last_seen_at            timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- ---------------------------------------------------------------- opportunities
create table public.opportunities (
  id                          uuid primary key default gen_random_uuid(),
  title                       text not null check (char_length(title) between 1 and 200),
  organization                text not null check (char_length(organization) between 1 and 200),
  description                 text not null default '',
  application_url             text check (application_url ~ '^https?://'),
  source_url                  text check (source_url ~ '^https?://'),
  opportunity_type            text not null check (opportunity_type in
    ('internship','job','summer_program','research','scholarship','apprenticeship','competition','volunteering','pre_college','other')),
  interests                   text[] not null default '{}',

  -- hard eligibility (null / empty = NOT STATED; never "open to all")
  min_age                     smallint check (min_age between 0 and 120),
  max_age                     smallint check (max_age between 0 and 120),
  age_reference_date          date,                    -- "must be 16 by <date>"; null = evaluate today
  min_grade                   smallint check (min_grade between 1 and 12),
  max_grade                   smallint check (max_grade between 1 and 12),
  eligible_graduation_years   smallint[] not null default '{}',
  allowed_states              text[] not null default '{}',   -- residency states: DC / MD / VA / ...
  residency_notes             text,                    -- free text; engine flags it as "confirm"
  allowed_zips                text[] not null default '{}',
  allowed_counties            text[] not null default '{}',   -- e.g. 'Montgomery County, MD'
  citizenship_requirement     text check (citizenship_requirement in ('us_citizen','us_citizen_or_permanent_resident','work_authorization')),
  min_gpa                     numeric(3,2) check (min_gpa between 0 and 5),
  schedule_period             text check (schedule_period in ('school_year','summer','both','flexible')),
  additional_eligibility_notes text,
  unstructured_requirements   text[] not null default '{}',   -- requirements we could not encode; each forces "Check Requirement"

  -- location
  location_name               text,
  location_city               text,
  location_state              text,
  location_zip                text check (location_zip ~ '^[0-9]{5}$'),
  location_lat                numeric(6,2),
  location_lng                numeric(6,2),
  work_mode                   text check (work_mode in ('in_person','remote','hybrid')),

  -- money
  is_paid                     boolean,                 -- null = unknown / not applicable
  compensation_description    text,

  -- dates
  application_open_date       date,
  application_deadline        date,
  program_start_date          date,
  program_end_date            date,

  -- data quality
  verification_status         text not null default 'unverified' check (verification_status in ('unverified','verified')),
  last_verified_at            timestamptz,
  verified_by                 uuid references auth.users(id) on delete set null,
  is_sample                   boolean not null default false,
  archived_at                 timestamptz,

  created_by                  uuid references auth.users(id) on delete set null,
  created_at                  timestamptz not null default now(),
  updated_at                  timestamptz not null default now(),

  constraint age_range   check (min_age   is null or max_age   is null or min_age   <= max_age),
  constraint grade_range check (min_grade is null or max_grade is null or min_grade <= max_grade),
  constraint open_before_deadline check (application_open_date is null or application_deadline is null or application_open_date <= application_deadline),
  constraint program_dates check (program_start_date is null or program_end_date is null or program_start_date <= program_end_date),
  -- a verified record must be traceable and usable
  constraint verified_has_basics check (
    verification_status <> 'verified'
    or (last_verified_at is not null and application_url is not null and source_url is not null)
  )
);
create index opportunities_live_idx on public.opportunities (application_deadline)
  where verification_status = 'verified' and archived_at is null;

create function public.set_updated_at() returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;
create trigger opportunities_updated before update on public.opportunities
  for each row execute function public.set_updated_at();
create trigger profiles_updated before update on public.profiles
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- student <-> opportunity
-- saved_at null = not currently saved. status is ONLY ever set by the student (self-report).
create table public.student_opportunities (
  user_id            uuid not null references auth.users(id) on delete cascade,
  opportunity_id     uuid not null references public.opportunities(id) on delete cascade,
  saved_at           timestamptz,
  apply_clicked_at   timestamptz,                -- last time the Apply link was opened. NOT proof of applying.
  status             text check (status in ('planning','applied','interview','accepted','not_selected','not_interested')),
  status_updated_at  timestamptz,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now(),
  primary key (user_id, opportunity_id)
);
create trigger student_opportunities_updated before update on public.student_opportunities
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------- analytics events
create table public.events (
  id             bigint generated always as identity primary key,
  created_at     timestamptz not null default now(),
  user_id        uuid references auth.users(id) on delete cascade,
  event_name     text not null check (event_name in (
    'landing_page_view','onboarding_started','onboarding_completed','opportunity_viewed',
    'opportunity_saved','opportunity_unsaved','application_link_clicked',
    'opportunity_status_changed','return_session')),
  opportunity_id uuid references public.opportunities(id) on delete set null,
  properties     jsonb not null default '{}'::jsonb check (pg_column_size(properties) < 2048)
);
create index events_name_time_idx on public.events (event_name, created_at);
create index events_user_idx on public.events (user_id, created_at);

-- ---------------------------------------------------------------- RLS
alter table public.interests            enable row level security;
alter table public.admins               enable row level security;
alter table public.profiles             enable row level security;
alter table public.opportunities        enable row level security;
alter table public.student_opportunities enable row level security;
alter table public.events               enable row level security;

create policy interests_read on public.interests for select to anon, authenticated using (true);
create policy interests_admin_write on public.interests for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy admins_self_read on public.admins for select to authenticated using (user_id = auth.uid());
-- no insert/update/delete policies: admins are added by SQL editor only (README)

create policy profiles_own_select on public.profiles for select to authenticated using (user_id = auth.uid());
create policy profiles_own_insert on public.profiles for insert to authenticated with check (user_id = auth.uid());
create policy profiles_own_update on public.profiles for update to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy profiles_own_delete on public.profiles for delete to authenticated using (user_id = auth.uid());

create policy opportunities_student_read on public.opportunities for select to authenticated
  using (verification_status = 'verified' and archived_at is null);
create policy opportunities_admin_all on public.opportunities for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

create policy so_own_all on public.student_opportunities for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy events_insert on public.events for insert to anon, authenticated
  with check (
    (user_id is null and event_name = 'landing_page_view')
    or user_id = auth.uid()
  );
create policy events_own_read on public.events for select to authenticated using (user_id = auth.uid());
create policy events_admin_read on public.events for select to authenticated using (public.is_admin());

-- ---------------------------------------------------------------- functions
-- Student-initiated account deletion (minors' data: make it easy to leave).
create function public.delete_my_account() returns void
language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then raise exception 'not authenticated'; end if;
  delete from auth.users where id = auth.uid();   -- cascades to profile, saves, events
end $$;

-- Admin-only aggregate metrics. Admin accounts are excluded so internal testing never inflates numbers.
create function public.admin_metrics() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare r jsonb;
begin
  if not public.is_admin() then raise exception 'forbidden' using errcode = '42501'; end if;
  with students as (
    select u.id from auth.users u where not exists (select 1 from public.admins a where a.user_id = u.id)
  ), ev as (
    select e.* from public.events e where e.user_id in (select id from students)
  ), so as (
    select s.* from public.student_opportunities s where s.user_id in (select id from students)
  )
  select jsonb_build_object(
    'registered_students', (select count(*) from students),
    'completed_profiles', (select count(*) from public.profiles p
        where p.onboarding_completed_at is not null and p.user_id in (select id from students)),
    'weekly_active_students', (select count(distinct user_id) from ev where created_at > now() - interval '7 days'),
    'views_total',            (select count(*) from ev where event_name = 'opportunity_viewed'),
    'views_unique_pairs',     (select count(distinct (user_id, opportunity_id)) from ev where event_name = 'opportunity_viewed'),
    'saves_total',            (select count(*) from ev where event_name = 'opportunity_saved'),
    'saves_unique_pairs',     (select count(distinct (user_id, opportunity_id)) from ev where event_name = 'opportunity_saved'),
    'clicks_total',           (select count(*) from ev where event_name = 'application_link_clicked'),
    'clicks_unique_pairs',    (select count(distinct (user_id, opportunity_id)) from ev where event_name = 'application_link_clicked'),
    'reported_applied_pairs',   (select count(*) from so where status in ('applied','interview','accepted','not_selected')),
    'reported_interview_pairs', (select count(*) from so where status in ('interview','accepted')),
    'reported_accepted_pairs',  (select count(*) from so where status = 'accepted'),
    'funnel', jsonb_build_object(
      'registered',        (select count(*) from students),
      'completed_profile', (select count(*) from public.profiles p
          where p.onboarding_completed_at is not null and p.user_id in (select id from students)),
      'saved',             (select count(distinct user_id) from ev where event_name = 'opportunity_saved'),
      'clicked',           (select count(distinct user_id) from ev where event_name = 'application_link_clicked'),
      'reported_applied',  (select count(distinct user_id) from so where status in ('applied','interview','accepted','not_selected')),
      'reported_interview',(select count(distinct user_id) from so where status in ('interview','accepted')),
      'reported_accepted', (select count(distinct user_id) from so where status = 'accepted')
    )
  ) into r;
  return r;
end $$;

revoke all on function public.admin_metrics() from public, anon;
revoke all on function public.delete_my_account() from public, anon;
grant execute on function public.admin_metrics() to authenticated;
grant execute on function public.delete_my_account() to authenticated;
