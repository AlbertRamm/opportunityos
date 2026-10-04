-- RLS / function tests. Run after the migration + seed on a scratch database (see README "Testing the database").
-- Any failed assertion aborts with an exception.
\set ON_ERROR_STOP on

create or replace function pg_temp.check(name text, ok boolean) returns void language plpgsql as $$
begin
  if ok is not true then raise exception 'FAIL: %', name; end if;
  raise notice 'ok   - %', name;
end $$;

-- fixtures (as superuser)
insert into auth.users (id, email) values
  ('aaaaaaaa-0000-0000-0000-000000000001', 'a@example.org'),
  ('bbbbbbbb-0000-0000-0000-000000000002', 'b@example.org'),
  ('cccccccc-0000-0000-0000-000000000003', 'admin@example.org');
insert into public.admins (user_id) values ('cccccccc-0000-0000-0000-000000000003');

create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  execute case when uid is null then 'set role anon' else 'set role authenticated' end;
end $$;

select pg_temp.check('seed has 10 samples, all flagged', (select count(*) = 10 and bool_and(is_sample) from public.opportunities));

-- ---- admin creates an unverified draft and an archived verified one
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into public.opportunities (title, organization, opportunity_type) values ('Draft', 'Org', 'internship');
insert into public.opportunities (title, organization, opportunity_type, application_url, source_url, verification_status, last_verified_at, archived_at)
  values ('Archived', 'Org', 'internship', 'https://example.org/a', 'https://example.org/s', 'verified', now(), now());
select pg_temp.check('admin sees everything (10 + 2)', (select count(*) = 12 from public.opportunities));

-- ---- student A
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select pg_temp.check('student sees only verified, non-archived (the 10 samples)', (select count(*) = 10 from public.opportunities));
select pg_temp.check('student cannot see drafts', (select count(*) = 0 from public.opportunities where title = 'Draft'));

do $$ begin
  begin
    insert into public.opportunities (title, organization, opportunity_type) values ('Hack', 'x', 'job');
    raise exception 'FAIL: student inserted an opportunity';
  exception when insufficient_privilege then raise notice 'ok   - student cannot insert opportunities'; end;
end $$;
with u as (update public.opportunities set title = 'pwned' returning 1)
select pg_temp.check('student cannot update opportunities', (select count(*) = 0 from u));

insert into public.profiles (user_id, first_name, birth_date, grade, graduation_year, zip, state, school_name,
  pay_preference, work_mode_preference, max_travel_miles, available_school_year, available_summer, onboarding_completed_at)
values ('aaaaaaaa-0000-0000-0000-000000000001', 'A', '2010-01-01', 10, 2029, '20001', 'DC', 'School', 'either', 'either', 25, true, true, now());
do $$ begin
  begin
    insert into public.profiles (user_id, first_name, birth_date, grade, graduation_year, zip, state, school_name,
      pay_preference, work_mode_preference, max_travel_miles, available_school_year, available_summer)
    values ('bbbbbbbb-0000-0000-0000-000000000002', 'B', '2010-01-01', 10, 2029, '20001', 'DC', 'School', 'either', 'either', 25, true, true);
    raise exception 'FAIL: student A wrote a profile for B';
  exception when insufficient_privilege then raise notice 'ok   - student cannot write another student''s profile'; end;
end $$;
do $$ begin
  begin
    insert into public.profiles (user_id, first_name, birth_date, grade, graduation_year, zip, state, school_name,
      pay_preference, work_mode_preference, max_travel_miles, available_school_year, available_summer)
    values ('aaaaaaaa-0000-0000-0000-000000000001', 'A', '2010-01-01', 8, 2029, '2000', 'XX', 'S', 'either', 'either', 7, true, true);
    raise exception 'FAIL: bad profile accepted';
  exception when check_violation or unique_violation then raise notice 'ok   - profile CHECK constraints reject bad data'; end;
end $$;

insert into public.student_opportunities (user_id, opportunity_id, saved_at)
  select 'aaaaaaaa-0000-0000-0000-000000000001', id, now() from public.opportunities limit 1;
select pg_temp.check('student reads own saves', (select count(*) = 1 from public.student_opportunities));
do $$ begin
  begin
    update public.student_opportunities set status = 'hired' where user_id = 'aaaaaaaa-0000-0000-0000-000000000001';
    raise exception 'FAIL: invalid status accepted';
  exception when check_violation then raise notice 'ok   - status CHECK constraint'; end;
end $$;

insert into public.events (user_id, event_name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'onboarding_completed');
insert into public.events (user_id, event_name) values ('aaaaaaaa-0000-0000-0000-000000000001', 'return_session');
do $$ begin
  begin
    insert into public.events (user_id, event_name) values ('bbbbbbbb-0000-0000-0000-000000000002', 'opportunity_saved');
    raise exception 'FAIL: spoofed event for another user';
  exception when insufficient_privilege then raise notice 'ok   - cannot spoof events for another user'; end;
end $$;
select pg_temp.check('student reads only own events', (select count(*) = 2 from public.events));
do $$ begin
  begin perform public.admin_metrics(); raise exception 'FAIL: student ran admin_metrics';
  exception when insufficient_privilege then raise notice 'ok   - student cannot call admin_metrics'; end;
end $$;

-- ---- student B cannot see A's data
select pg_temp.as_user('bbbbbbbb-0000-0000-0000-000000000002');
select pg_temp.check('B cannot read A''s profile', (select count(*) = 0 from public.profiles));
select pg_temp.check('B cannot read A''s saves', (select count(*) = 0 from public.student_opportunities));
select pg_temp.check('B cannot read A''s events', (select count(*) = 0 from public.events));

-- ---- anonymous visitor
select pg_temp.as_user(null);
select pg_temp.check('anon cannot read opportunities (no table privilege at all)', not has_table_privilege('anon', 'public.opportunities', 'select'));
insert into public.events (user_id, event_name) values (null, 'landing_page_view');
do $$ begin
  begin insert into public.events (user_id, event_name) values (null, 'application_link_clicked'); raise exception 'FAIL: anon wrote a non-landing event';
  exception when insufficient_privilege then raise notice 'ok   - anon can only log landing_page_view'; end;
end $$;
select pg_temp.check('anon can read interests', (select count(*) = 16 from public.interests));

-- ---- admin metrics
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
insert into public.events (user_id, event_name) values ('cccccccc-0000-0000-0000-000000000003', 'opportunity_viewed');
select pg_temp.check('admin_metrics excludes admin accounts',
  (select (public.admin_metrics()->>'registered_students')::int = 2 and (public.admin_metrics()->>'views_total')::int = 0));
select pg_temp.check('funnel: 1 completed profile, 0 clicks',
  (select (public.admin_metrics()->'funnel'->>'completed_profile')::int = 1 and (public.admin_metrics()->'funnel'->>'clicked')::int = 0));
select pg_temp.check('weekly active counts student A only', (select (public.admin_metrics()->>'weekly_active_students')::int = 1));

-- ---- DB-level data-quality rule
do $$ begin
  begin
    insert into public.opportunities (title, organization, opportunity_type, verification_status, last_verified_at)
    values ('No URLs', 'x', 'job', 'verified', now());
    raise exception 'FAIL: verified record without URLs accepted';
  exception when check_violation then raise notice 'ok   - cannot verify a record without application/source URL'; end;
end $$;

-- ---- account deletion cascades
select pg_temp.as_user('aaaaaaaa-0000-0000-0000-000000000001');
select public.delete_my_account();
reset role;
select pg_temp.check('delete_my_account removes user, profile, saves, events',
  (select count(*) = 0 from auth.users where id = 'aaaaaaaa-0000-0000-0000-000000000001')
  and (select count(*) = 0 from public.profiles) and (select count(*) = 0 from public.student_opportunities)
  and (select count(*) = 0 from public.events where user_id = 'aaaaaaaa-0000-0000-0000-000000000001'));
select 'ALL DB TESTS PASSED' as result;
