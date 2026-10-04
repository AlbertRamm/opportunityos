-- Read-only. Paste into the Supabase SQL editor (or run with psql) AFTER applying both migrations.
-- Every row must show ok = true. The last row is the verdict. Nothing here modifies data.
with expected_tables(t) as (values ('interests'),('profiles'),('opportunities'),('student_opportunities'),('events'),('admins'),
  ('opportunity_admin'),('opportunity_audit'),('match_feedback'),('cron_secret'),('reminder_log')),
expected_policies(t, p) as (values
  ('interests','interests_read'),('opportunities','opportunities_student_read'),('opportunities','opportunities_admin_all'),
  ('profiles','profiles_own_select'),('student_opportunities','so_own_all'),('events','events_own_read'),('events','events_insert'),
  ('opportunity_admin','opportunity_admin_all'),('opportunity_audit','opportunity_audit_read'),('match_feedback','match_feedback_own')),
expected_functions(sig) as (values ('is_admin()'),('admin_metrics()'),('admin_feedback_summary()'),('delete_my_account()'),('audit_opportunity()'),
  ('_cron_ok(text)'),('claim_due_reminders(text,date)'),('confirm_reminder(text,bigint,boolean)'),('unsubscribe_reminders(text,uuid)')),
checks as (
  select 1 as n, 'table exists: ' || t as check_name, to_regclass('public.' || t) is not null as ok from expected_tables
  union all
  select 2, 'RLS enabled: ' || t, coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.' || t)), false) from expected_tables
  union all
  select 3, 'policy: ' || t || '.' || p, exists (select 1 from pg_policies where schemaname = 'public' and tablename = t and policyname = p) from expected_policies
  union all
  select 4, 'function exists: ' || sig, to_regprocedure('public.' || sig) is not null from expected_functions
  union all
  select 5, 'anon CANNOT call admin_metrics()', to_regprocedure('public.admin_metrics()') is not null and not has_function_privilege('anon', 'public.admin_metrics()', 'execute')
  union all
  select 5, 'anon CANNOT call admin_feedback_summary()', to_regprocedure('public.admin_feedback_summary()') is not null and not has_function_privilege('anon', 'public.admin_feedback_summary()', 'execute')
  union all
  select 5, 'anon CANNOT call _cron_ok() directly', to_regprocedure('public._cron_ok(text)') is not null and not has_function_privilege('anon', 'public._cron_ok(text)', 'execute')
  union all
  select 5, 'anon CAN call claim_due_reminders() (secret-gated inside)', to_regprocedure('public.claim_due_reminders(text,date)') is not null and has_function_privilege('anon', 'public.claim_due_reminders(text,date)', 'execute')
  union all
  select 5, 'students/anon have NO direct privileges on cron_secret/reminder_log rows via policy', not exists (select 1 from pg_policies where schemaname = 'public' and tablename in ('cron_secret','reminder_log'))
  union all
  select 6, 'reminders skip samples (migration 20261005)', pg_get_functiondef(to_regprocedure('public.claim_due_reminders(text,date)')) like '%not o.is_sample%'
  union all
  select 6, 'table grants (20261006): ' || t || ' ' || priv, has_table_privilege(r, 'public.' || t, priv)
    from (values ('authenticated','profiles','insert'),('authenticated','profiles','update'),('authenticated','profiles','select'),
                 ('authenticated','opportunities','select'),('authenticated','student_opportunities','insert'),
                 ('authenticated','match_feedback','insert'),('authenticated','events','insert'),('anon','events','insert'),
                 ('anon','interests','select')) g(r, t, priv)
  union all
  select 6, 'anon/authenticated have NO privileges on cron_secret/reminder_log',
         not (has_table_privilege('anon','public.cron_secret','select') or has_table_privilege('authenticated','public.cron_secret','select')
           or has_table_privilege('anon','public.reminder_log','select') or has_table_privilege('authenticated','public.reminder_log','select'))
  union all
  select 6, 'admin grants are audited (migration 20261007)', to_regclass('public.admin_audit') is not null
         and exists (select 1 from pg_trigger where tgname = 'admins_audit' and not tgisinternal)
         and not has_table_privilege('authenticated','public.admin_audit','select')
  union all
  select 6, 'column profiles.email_reminders', exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name = 'email_reminders')
  union all
  select 6, 'Match details columns + constraints (migration 20261008)',
         (select count(*) = 6 from information_schema.columns where table_schema = 'public' and table_name = 'profiles' and column_name in ('gpa_value','gpa_scale','gpa_weighting','attest_financial_need','attest_citizenship','college_plan'))
         and exists (select 1 from pg_constraint where conname = 'profiles_match_details_valid')
         and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'opportunities' and column_name = 'attested_requirements')
  union all
  select 6, 'trigger opportunities_audit', exists (select 1 from pg_trigger where tgname = 'opportunities_audit' and not tgisinternal)
  union all
  select 6, 'events accepts match_feedback_submitted', exists (select 1 from pg_constraint where conname = 'events_event_name_check' and pg_get_constraintdef(oid) like '%match_feedback_submitted%')
  union all
  select 7, '16 active interests present', (select count(*) = 16 from public.interests where active and slug in
      ('electrical_engineering','computer_engineering','computer_science','semiconductors','mechanical_engineering','civil_engineering','aerospace',
       'biology_medicine','chemistry','environment_climate','business','finance','government_policy','arts_design','education','other'))
)
select check_name, ok from checks
union all
select '== VERDICT: ' || case when bool_and(ok) then 'ALL ' || count(*) || ' CHECKS PASSED' else count(*) filter (where not ok) || ' CHECK(S) FAILED' end, bool_and(ok) from checks
union all
-- informational (not part of the verdict)
select 'INFO cron_secret hash stored: ' || case when to_regclass('public.cron_secret') is null then 'table missing'
         else (xpath('/row/c/text()', query_to_xml('select count(*) as c from public.cron_secret', false, true, '')))[1]::text end
       || ' (expect 1 after reminder setup)', true
union all
select 'INFO opportunities: ' || count(*) filter (where is_sample) || ' sample, ' || count(*) filter (where not is_sample and verification_status = 'verified') || ' real verified, '
       || count(*) filter (where not is_sample and verification_status = 'unverified') || ' real drafts', true from public.opportunities
order by 1 desc;
