-- Tests for provenance/audit, feedback, reminders. Run after rls.test.sql (same scratch DB).
\set ON_ERROR_STOP on
create or replace function pg_temp.check(name text, ok boolean) returns void language plpgsql as $$
begin if ok is not true then raise exception 'FAIL: %', name; end if; raise notice 'ok   - %', name; end $$;
create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claim.sub', coalesce(uid::text, ''), false);
  execute case when uid is null then 'set role anon' else 'set role authenticated' end;
end $$;

reset role;
insert into auth.users (id, email) values
  ('cccccccc-0000-0000-0000-000000000003', 'admin@example.org') on conflict do nothing;
insert into public.admins (user_id) values ('cccccccc-0000-0000-0000-000000000003') on conflict do nothing;
insert into auth.users (id, email) values
  ('dddddddd-0000-0000-0000-00000000000d', 'd@example.org'),
  ('eeeeeeee-0000-0000-0000-00000000000e', 'e@example.org'),
  ('ffffffff-0000-0000-0000-00000000000f', 'f@example.org'),
  ('99999999-0000-0000-0000-000000000009', 'g@example.org');
insert into public.profiles (user_id, first_name, birth_date, grade, graduation_year, zip, state, school_name,
  pay_preference, work_mode_preference, max_travel_miles, available_school_year, available_summer, onboarding_completed_at, email_reminders)
select u, n, '2010-01-01', 10, 2029, '20001', 'DC', 'S', 'either', 'either', 25, true, true, now(), r
from (values ('dddddddd-0000-0000-0000-00000000000d'::uuid, 'D', true), ('eeeeeeee-0000-0000-0000-00000000000e', 'E', false),
             ('ffffffff-0000-0000-0000-00000000000f', 'F', true), ('99999999-0000-0000-0000-000000000009', 'G', true)) t(u, n, r);

-- opportunities used by the tests (deadlines relative to today in New York)
create or replace function pg_temp.mk(t text, dl int, st text default 'verified', arch boolean default false) returns uuid language plpgsql as $$
declare i uuid;
begin
  insert into public.opportunities (title, organization, opportunity_type, application_url, source_url, verification_status, last_verified_at,
      application_deadline, archived_at)
  values (t, 'Org', 'internship', 'https://example.org/a', 'https://example.org/s', st, case when st = 'verified' then now() end,
      (now() at time zone 'America/New_York')::date + dl, case when arch then now() end) returning id into i;
  return i;
end $$;
select pg_temp.mk('T-5d', 5), pg_temp.mk('T-1d', 1), pg_temp.mk('T-10d', 10), pg_temp.mk('T-expired', -1),
       pg_temp.mk('T-archived', 3, 'verified', true), pg_temp.mk('T-draft', 3, 'unverified'), pg_temp.mk('T-applied', 4);
create or replace function pg_temp.oid(t text) returns uuid language sql as $$ select id from public.opportunities where title = t $$;

-- ------------------------------------------------------------- admin-only evidence + audit
insert into public.opportunity_admin (opportunity_id, import_batch, source_evidence)
  values (pg_temp.oid('T-5d'), 'batch-1', '{"application_deadline":{"quote":"Apply by X","url":"https://example.org/s"}}');

select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
update public.opportunities set description = 'edited' where title = 'T-5d';
select pg_temp.check('audit records an admin edit with who/when/old/new',
  (select count(*) = 1 and bool_and(changed_by = 'cccccccc-0000-0000-0000-000000000003') and bool_and(old_row->>'description' is distinct from 'edited')
     from public.opportunity_audit where opportunity_id = pg_temp.oid('T-5d') and action = 'update'));
select pg_temp.check('admin can read evidence', (select count(*) = 1 from public.opportunity_admin));

select pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');
select pg_temp.check('student cannot read evidence', (select count(*) = 0 from public.opportunity_admin));
select pg_temp.check('student cannot read audit log', (select count(*) = 0 from public.opportunity_audit));
select pg_temp.check('student cannot read reminder_log or cron_secret (no table privilege)', not has_table_privilege('authenticated', 'public.reminder_log', 'select') and not has_table_privilege('authenticated', 'public.cron_secret', 'select'));

-- ------------------------------------------------------------- feedback
insert into public.match_feedback (user_id, opportunity_id, reason, match_status)
  values ('dddddddd-0000-0000-0000-00000000000d', pg_temp.oid('T-5d'), 'topic', 'strong_match');
do $$ begin
  begin insert into public.match_feedback (user_id, opportunity_id, reason, match_status)
        values ('eeeeeeee-0000-0000-0000-00000000000e', pg_temp.oid('T-5d'), 'topic', 'eligible');
        raise exception 'FAIL: wrote feedback as another user';
  exception when insufficient_privilege then raise notice 'ok   - cannot write feedback for another student'; end;
  begin insert into public.match_feedback (user_id, opportunity_id, reason, match_status)
        values ('dddddddd-0000-0000-0000-00000000000d', pg_temp.oid('T-1d'), 'because I said so', 'eligible');
        raise exception 'FAIL: free-text reason accepted';
  exception when check_violation then raise notice 'ok   - reason must be from the picklist (no free text)'; end;
end $$;
select pg_temp.as_user('eeeeeeee-0000-0000-0000-00000000000e');
select pg_temp.check('student cannot read others feedback', (select count(*) = 0 from public.match_feedback));
do $$ begin
  begin perform public.admin_feedback_summary(); raise exception 'FAIL: student read feedback summary';
  exception when insufficient_privilege then raise notice 'ok   - student cannot call admin_feedback_summary'; end;
end $$;

select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.check('summary: counts shown, per-opportunity suppressed below 3 students',
  (select (j->>'total')::int = 1 and jsonb_array_length(j->'by_opportunity') = 0 and (j->>'suppressed_opportunities')::int = 1
     and j->'by_reason'->>'topic' = '1' from (select public.admin_feedback_summary() j) x));
reset role;
insert into public.match_feedback (user_id, opportunity_id, reason, match_status) values
  ('eeeeeeee-0000-0000-0000-00000000000e', pg_temp.oid('T-5d'), 'eligibility_wrong', 'eligible'),
  ('ffffffff-0000-0000-0000-00000000000f', pg_temp.oid('T-5d'), 'info_outdated', 'check_requirement');
select pg_temp.as_user('cccccccc-0000-0000-0000-000000000003');
select pg_temp.check('summary: opportunity revealed once 3 students answered; no user ids leak',
  (select jsonb_array_length(j->'by_opportunity') = 1 and (j->'by_opportunity'->0->>'eligibility_wrong')::int = 1
     and j::text !~* '(dddddddd|eeeeeeee|ffffffff)' from (select public.admin_feedback_summary() j) x));

-- ------------------------------------------------------------- reminders
reset role;
insert into public.cron_secret (id, secret_hash) values (1, encode(sha256(convert_to('test-secret-0123456789-abcdefghijkl', 'UTF8')), 'hex'));
insert into public.student_opportunities (user_id, opportunity_id, saved_at, status) values
  ('dddddddd-0000-0000-0000-00000000000d', pg_temp.oid('T-5d'),  now() - interval '10 days', null),        -- due 7d
  ('dddddddd-0000-0000-0000-00000000000d', pg_temp.oid('T-1d'),  now() - interval '10 days', 'planning'), -- due 2d only (not both)
  ('dddddddd-0000-0000-0000-00000000000d', pg_temp.oid('T-10d'), now() - interval '10 days', null),       -- too early
  ('dddddddd-0000-0000-0000-00000000000d', pg_temp.oid('T-expired'), now() - interval '10 days', null),   -- expired
  ('dddddddd-0000-0000-0000-00000000000d', pg_temp.oid('T-archived'), now() - interval '10 days', null),  -- archived
  ('dddddddd-0000-0000-0000-00000000000d', pg_temp.oid('T-draft'), now() - interval '10 days', null),     -- unverified
  ('dddddddd-0000-0000-0000-00000000000d', pg_temp.oid('T-applied'), now() - interval '10 days', 'applied'), -- already applied
  ('eeeeeeee-0000-0000-0000-00000000000e', pg_temp.oid('T-5d'),  now() - interval '10 days', null),        -- opted out
  ('ffffffff-0000-0000-0000-00000000000f', pg_temp.oid('T-5d'),  now(), null),                              -- saved inside the window
  ('99999999-0000-0000-0000-000000000009', pg_temp.oid('T-5d'),  null, null);                               -- clicked but not saved

do $$ begin
  begin perform * from public.claim_due_reminders('wrong', current_date); raise exception 'FAIL: wrong secret accepted';
  exception when insufficient_privilege then raise notice 'ok   - claim_due_reminders rejects a wrong secret'; end;
end $$;
select pg_temp.as_user(null);   -- the cron route calls with the anon key
create temp table claim1 on commit preserve rows as
  select * from public.claim_due_reminders('test-secret-0123456789-abcdefghijkl', (now() at time zone 'America/New_York')::date);
select pg_temp.check('exactly the right reminders are due (7d for T-5d; 2d for T-1d)',
  (select count(*) = 2 and bool_or(title = 'T-5d' and kind = '7d' and days_left = 5 and email = 'd@example.org')
       and bool_or(title = 'T-1d' and kind = '2d' and days_left = 1) from claim1));
select pg_temp.check('no reminder for too-early, expired, archived, unverified, applied, opted-out, saved-late, unsaved',
  (select count(*) = 0 from claim1 where title in ('T-10d','T-expired','T-archived','T-draft','T-applied') or email in ('e@example.org','f@example.org','g@example.org')));
select pg_temp.check('a second run the same day sends nothing (idempotent)',
  (select count(*) = 0 from public.claim_due_reminders('test-secret-0123456789-abcdefghijkl', (now() at time zone 'America/New_York')::date)));
select public.confirm_reminder('test-secret-0123456789-abcdefghijkl', (select log_id from claim1 where title = 'T-5d'), true);
reset role;
select pg_temp.check('confirm marks sent', (select status = 'sent' and sent_at is not null from public.reminder_log l join claim1 c on c.log_id = l.id where c.title = 'T-5d'));
select pg_temp.check('unconfirmed claim stays pending for retry', (select status = 'pending' from public.reminder_log l join claim1 c on c.log_id = l.id where c.title = 'T-1d'));
-- simulate a crashed run: pending claim older than 30 min is retried once, up to 3 attempts, then failed
update public.reminder_log set created_at = now() - interval '2 hours' where id = (select log_id from claim1 where title = 'T-1d');
select pg_temp.as_user(null);
select pg_temp.check('stale pending claim is re-offered', (select count(*) = 1 from public.claim_due_reminders('test-secret-0123456789-abcdefghijkl', (now() at time zone 'America/New_York')::date)));
reset role;
update public.reminder_log set attempts = 3, created_at = now() - interval '2 hours' where id = (select log_id from claim1 where title = 'T-1d');
select pg_temp.as_user(null);
select pg_temp.check('after 3 attempts it is marked failed, not re-sent', (select count(*) = 0 from public.claim_due_reminders('test-secret-0123456789-abcdefghijkl', (now() at time zone 'America/New_York')::date)));
reset role;
select pg_temp.check('failed status recorded', (select status = 'failed' from public.reminder_log l join claim1 c on c.log_id = l.id where c.title = 'T-1d'));

-- unsubscribe
select pg_temp.as_user(null);
select public.unsubscribe_reminders('test-secret-0123456789-abcdefghijkl', 'dddddddd-0000-0000-0000-00000000000d');
reset role;
select pg_temp.check('unsubscribe turns reminders off', (select not email_reminders from public.profiles where user_id = 'dddddddd-0000-0000-0000-00000000000d'));
select pg_temp.as_user(null);
do $$ begin
  begin perform public.unsubscribe_reminders('wrong', 'eeeeeeee-0000-0000-0000-00000000000e'); raise exception 'FAIL: unsubscribe with wrong secret';
  exception when insufficient_privilege then raise notice 'ok   - unsubscribe requires the secret'; end;
end $$;
reset role;
-- samples never trigger reminders
reset role;
update public.profiles set email_reminders = true where user_id = 'dddddddd-0000-0000-0000-00000000000d';
update public.reminder_log set status = 'sent' where status in ('pending','failed');
insert into public.opportunities (title, organization, opportunity_type, application_url, source_url, verification_status, last_verified_at, application_deadline, is_sample)
  values ('T-sample', 'Org', 'internship', 'https://example.org/a', 'https://example.org/s', 'verified', now(), (now() at time zone 'America/New_York')::date + 3, true);
insert into public.student_opportunities (user_id, opportunity_id, saved_at) values ('dddddddd-0000-0000-0000-00000000000d', pg_temp.oid('T-sample'), now() - interval '10 days');
select pg_temp.as_user(null);
select pg_temp.check('a SAMPLE listing never produces a reminder',
  (select count(*) = 0 from public.claim_due_reminders('test-secret-0123456789-abcdefghijkl', (now() at time zone 'America/New_York')::date) where title = 'T-sample'));
reset role;
-- admin grants/revokes are audited, and no API role can read or alter the trail or the admins table
reset role;
select pg_temp.check('granting admin wrote an audit row with the email',
  (select count(*) = 1 from public.admin_audit where action = 'grant' and email = 'admin@example.org'));
delete from public.admins where user_id = 'cccccccc-0000-0000-0000-000000000003';
select pg_temp.check('revoking admin wrote an audit row', (select count(*) = 1 from public.admin_audit where action = 'revoke' and email = 'admin@example.org'));
insert into public.admins (user_id) values ('cccccccc-0000-0000-0000-000000000003');
select pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');
select pg_temp.check('a student cannot read admin_audit', not has_table_privilege('authenticated','public.admin_audit','select'));
select pg_temp.check('a student cannot add themselves to admins', not has_table_privilege('authenticated','public.admins','insert'));
reset role;
-- Match details (migration 20261008): own-row only, constrained, nullable
reset role;
update public.profiles set gpa_value = 3.5, gpa_scale = '4.0', gpa_weighting = 'unweighted', attest_citizenship = 'prefer_not'
  where user_id = 'dddddddd-0000-0000-0000-00000000000d';
select pg_temp.as_user('eeeeeeee-0000-0000-0000-00000000000e');
select pg_temp.check('another student cannot read someone else''s Match details',
  (select count(*) = 0 from public.profiles where user_id = 'dddddddd-0000-0000-0000-00000000000d' and gpa_value is not null));
select pg_temp.as_user('dddddddd-0000-0000-0000-00000000000d');
select pg_temp.check('a student reads their own Match details', (select gpa_value = 3.5 and attest_citizenship = 'prefer_not' from public.profiles));
update public.profiles set gpa_value = null, gpa_scale = null, gpa_weighting = null, attest_citizenship = null;
select pg_temp.check('a student can clear Match details',
  (select gpa_value is null and gpa_scale is null and attest_citizenship is null from public.profiles));
select pg_temp.as_user(null);
select pg_temp.check('anon has no access to profiles', not has_table_privilege('anon', 'public.profiles', 'select'));
reset role;
do $$ begin
  begin update public.profiles set gpa_value = 4.5, gpa_scale = '4.0', gpa_weighting = 'weighted' where user_id = 'dddddddd-0000-0000-0000-00000000000d'; raise exception 'FAIL: out-of-range GPA accepted';
  exception when check_violation then raise notice 'ok   - out-of-range GPA is rejected'; end;
  begin update public.profiles set attest_citizenship = 'green_card' where user_id = 'dddddddd-0000-0000-0000-00000000000d'; raise exception 'FAIL: free-text citizenship accepted';
  exception when check_violation then raise notice 'ok   - citizenship accepts only the four coarse answers'; end;
end $$;
select 'ALL V0.2 DB TESTS PASSED' as result;
