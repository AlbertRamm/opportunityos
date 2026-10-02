-- =====================================================================================
-- SAMPLE DATA — FICTIONAL. Every organization, program, requirement, and URL below is made up
-- so the app can be tested. They are all flagged is_sample = true and show a "Sample data" badge.
-- Dates are relative to today so the samples never go stale. Safe to re-run.
--
-- Before launch: run supabase/remove-samples.sql, then enter real, manually verified opportunities
-- via /admin. NEVER copy requirements for a real organization from memory.
-- =====================================================================================

delete from public.opportunities where is_sample;

with senior_grad as (
  select (extract(year from current_date)::int + case when extract(month from current_date) >= 7 then 1 else 0 end) as y
)
insert into public.opportunities (
  title, organization, description, application_url, source_url, opportunity_type, interests,
  min_age, max_age, min_grade, max_grade, eligible_graduation_years, allowed_states, allowed_counties,
  citizenship_requirement, min_gpa, schedule_period, unstructured_requirements, additional_eligibility_notes,
  location_name, location_city, location_state, location_zip, location_lat, location_lng, work_mode,
  is_paid, compensation_description, application_open_date, application_deadline, program_start_date, program_end_date,
  verification_status, last_verified_at, is_sample
)
select * from (values
  -- 1. Strong-match candidate for EE/chips students in DC/MD/VA
  ('Sample: Chip Design Summer Internship', 'Sample Semiconductor Co. (fictional)',
   E'SAMPLE DATA. A fictional paid summer internship where students shadow engineers on a small digital-chip layout team.',
   'https://example.org/sample/chip-internship/apply', 'https://example.org/sample/chip-internship', 'internship',
   array['semiconductors','electrical_engineering','computer_engineering'],
   16, null, 10, 12, '{}'::smallint[], array['DC','MD','VA'], '{}'::text[],
   null, null, 'summer', '{}'::text[], null,
   'Sample HQ', 'Arlington', 'VA', '22201', 38.89, -77.09, 'in_person',
   true, '$20/hour (sample)', null, current_date + 12, current_date + 200, current_date + 270,
   'verified', now() - interval '3 days', true),

  -- 2. Remote research; citizenship stated -> Check Requirement
  ('Sample: Remote Machine Learning Research Program', 'Sample Institute for Computing (fictional)',
   E'SAMPLE DATA. A fictional remote research program pairing students with a mentor on a small ML project.',
   'https://example.org/sample/ml-research/apply', 'https://example.org/sample/ml-research', 'research',
   array['computer_science','computer_engineering'],
   null, null, 11, 12, '{}'::smallint[], '{}'::text[], '{}'::text[],
   'us_citizen_or_permanent_resident', null, 'both', '{}'::text[], null,
   null, null, null, null, null, null, 'remote',
   false, 'Unpaid; certificate of completion (sample)', null, current_date + 40, current_date + 90, current_date + 160,
   'verified', now() - interval '5 days', true),

  -- 3. DC-only senior scholarship with GPA -> Check Requirement; grad-year restriction
  ('Sample: DC Public Service Scholarship', 'Sample Capital Civic Fund (fictional)',
   E'SAMPLE DATA. A fictional one-time scholarship for DC seniors interested in public policy.',
   'https://example.org/sample/dc-scholarship/apply', 'https://example.org/sample/dc-scholarship', 'scholarship',
   array['government_policy','education'],
   null, null, 12, 12, array[(select y from senior_grad)]::smallint[], array['DC'], '{}'::text[],
   null, 3.00, null, '{}'::text[], 'Weighted or unweighted GPA not specified in the sample.',
   null, 'Washington', 'DC', null, null, null, null,
   null, '$2,500 one-time award (sample)', null, current_date + 25, null, null,
   'verified', now() - interval '2 days', true),

  -- 4. Maryland-only, closing soon (tests Apply Soon + state mismatch for DC/VA students)
  ('Sample: Maryland Environmental Fellowship', 'Sample Chesapeake Conservation Network (fictional)',
   E'SAMPLE DATA. A fictional paid summer fellowship doing field work on watershed restoration.',
   'https://example.org/sample/md-fellowship/apply', 'https://example.org/sample/md-fellowship', 'summer_program',
   array['environment_climate','biology_medicine'],
   14, null, 9, 11, '{}'::smallint[], array['MD'], '{}'::text[],
   null, null, 'summer', '{}'::text[], null,
   'Sample Field Station', 'Bethesda', 'MD', '20814', 38.98, -77.10, 'in_person',
   true, '$1,800 stipend (sample)', null, current_date + 5, current_date + 210, current_date + 260,
   'verified', now() - interval '1 days', true),

  -- 5. Virginia competition with a team rule we could not encode
  ('Sample: Virginia Student Robotics Challenge', 'Sample Old Dominion Robotics League (fictional)',
   E'SAMPLE DATA. A fictional team robotics competition for Virginia students.',
   'https://example.org/sample/va-robotics/apply', 'https://example.org/sample/va-robotics', 'competition',
   array['mechanical_engineering','computer_engineering','aerospace'],
   13, 18, 9, 12, '{}'::smallint[], array['VA'], '{}'::text[],
   null, null, 'school_year', array['Teams of 3–5 students must register together (sample rule)'], null,
   'Sample Convention Center', 'Richmond', 'VA', '23219', 37.54, -77.43, 'in_person',
   null, 'No fee; prizes (sample)', null, current_date + 60, current_date + 120, current_date + 121,
   'verified', now() - interval '6 days', true),

  -- 6. Age 18+ apprenticeship (age-ineligible for most high-school students)
  ('Sample: Biotech Lab Apprenticeship (18+)', 'Sample Genome Works (fictional)',
   E'SAMPLE DATA. A fictional paid apprenticeship that requires applicants to be at least 18.',
   'https://example.org/sample/biotech-apprenticeship/apply', 'https://example.org/sample/biotech-apprenticeship', 'apprenticeship',
   array['biology_medicine','chemistry'],
   18, null, 12, 12, '{}'::smallint[], array['DC','MD','VA'], '{}'::text[],
   null, null, 'both', '{}'::text[], null,
   'Sample Lab', 'Rockville', 'MD', '20850', 39.08, -77.15, 'in_person',
   true, '$17/hour (sample)', null, current_date + 30, current_date + 120, current_date + 400,
   'verified', now() - interval '4 days', true),

  -- 7. Rolling volunteering, county restriction -> Check Requirement; no deadline
  ('Sample: Community Garden Volunteers', 'Sample Montgomery Green Spaces (fictional)',
   E'SAMPLE DATA. A fictional rolling volunteer program for county residents.',
   'https://example.org/sample/garden/apply', 'https://example.org/sample/garden', 'volunteering',
   array['environment_climate','education'],
   null, null, 9, 12, '{}'::smallint[], '{}'::text[], array['Montgomery County, MD'],
   null, null, 'flexible', '{}'::text[], null,
   'Sample Community Garden', 'Silver Spring', 'MD', '20910', 38.99, -77.03, 'in_person',
   false, null, null, null, null, null,
   'verified', now() - interval '10 days', true),

  -- 8. Pre-college program with requirements we could not encode
  ('Sample: Pre-College Engineering Academy', 'Sample Tech University Outreach (fictional)',
   E'SAMPLE DATA. A fictional two-week residential pre-college program with electrical, civil, and mechanical tracks.',
   'https://example.org/sample/precollege/apply', 'https://example.org/sample/precollege', 'pre_college',
   array['electrical_engineering','civil_engineering','mechanical_engineering'],
   null, null, 10, 12, '{}'::smallint[], '{}'::text[], '{}'::text[],
   null, null, 'summer', array['Teacher recommendation required','Short essay required'], null,
   'Sample University', 'College Park', 'MD', '20742', 38.99, -76.94, 'in_person',
   false, 'Tuition applies; need-based aid mentioned (sample)', current_date - 5, current_date + 20, current_date + 220, current_date + 234,
   'verified', now() - interval '7 days', true),

  -- 9. Expired deadline: must NEVER be recommended
  ('Sample: Finance Workshop (deadline passed)', 'Sample Wall Street West (fictional)',
   E'SAMPLE DATA. A fictional workshop whose deadline has already passed. It should never appear in recommendations.',
   'https://example.org/sample/finance/apply', 'https://example.org/sample/finance', 'summer_program',
   array['finance','business'],
   null, null, 10, 12, '{}'::smallint[], '{}'::text[], '{}'::text[],
   null, null, 'summer', '{}'::text[], null,
   null, 'Washington', 'DC', null, null, null, 'hybrid',
   false, null, current_date - 60, current_date - 10, current_date + 40, current_date + 60,
   'verified', now() - interval '20 days', true),

  -- 10. Remote paid job with stale verification (tests the "needs recheck" flag)
  ('Sample: Part-Time Web Developer (stale listing)', 'Sample Pixel Studio (fictional)',
   E'SAMPLE DATA. A fictional remote part-time job. Its verification date is deliberately old to demo the re-verification flag.',
   'https://example.org/sample/web-dev/apply', 'https://example.org/sample/web-dev', 'job',
   array['computer_science','arts_design'],
   16, null, 11, 12, '{}'::smallint[], '{}'::text[], '{}'::text[],
   null, null, 'school_year', '{}'::text[], null,
   null, null, null, null, null, null, 'remote',
   true, '$22/hour (sample)', null, current_date + 90, null, null,
   'verified', now() - interval '60 days', true)
) as t;
