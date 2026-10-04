-- Optional "Match details" (V0.1): a few self-attested answers that let deterministic matching resolve rules it
-- previously had to leave as "Check requirement". Everything is nullable; existing users and rows are untouched.
-- Data-minimization decision: docs/DATA_MODEL_PRIVACY.md. No citizenship/immigration status, income, or documents.

-- ------------------------------------------------------------------ profiles (student-owned; RLS already own-row only)
alter table public.profiles
  add column if not exists gpa_value            numeric(5,2),
  add column if not exists gpa_scale            text,
  add column if not exists gpa_weighting        text,
  add column if not exists attest_financial_need text,
  add column if not exists attest_citizenship   text,
  add column if not exists college_plan         text;

alter table public.profiles drop constraint if exists profiles_match_details_valid;
alter table public.profiles add constraint profiles_match_details_valid check (
  (gpa_scale is null or gpa_scale in ('4.0','5.0','100','other'))
  and (gpa_weighting is null or gpa_weighting in ('unweighted','weighted','not_sure'))
  and (attest_financial_need is null or attest_financial_need in ('yes','no','not_sure','prefer_not'))
  and (attest_citizenship    is null or attest_citizenship    in ('yes','no','not_sure','prefer_not'))
  and (college_plan          is null or college_plan          in ('four_year','two_year_or_vocational','undecided','prefer_not'))
  -- a GPA is all-or-nothing: value + scale + weighting, within the declared scale
  and (
    (gpa_value is null and gpa_scale is null and gpa_weighting is null)
    or (gpa_value is not null and gpa_scale is not null and gpa_weighting is not null and gpa_value >= 0
        and gpa_value <= case gpa_scale when '4.0' then 4 when '5.0' then 5 else 100 end)
  )
);

comment on column public.profiles.gpa_value is 'Optional self-reported GPA. Never shown to providers or admins in aggregate.';
comment on column public.profiles.attest_citizenship is 'Coarse yes/no/not_sure/prefer_not: "I meet U.S. citizenship or permanent-residency requirements commonly used by scholarships". Not a status.';

-- ------------------------------------------------------------ opportunities (public, admin-managed)
alter table public.opportunities
  add column if not exists attested_requirements text[] not null default '{}';
alter table public.opportunities drop constraint if exists opportunities_attested_valid;
alter table public.opportunities add constraint opportunities_attested_valid
  check (attested_requirements <@ array['financial_need','college_four_year','college_any']::text[]);

-- Backfill: move rules that the verified records ALREADY state (each backed by its verbatim evidence quote at
-- verification time) from free text into structured fields. Nothing new is asserted; last_verified_at is unchanged,
-- and the audit trigger records every change in opportunity_audit.
update public.opportunities set
  attested_requirements = array['financial_need','college_four_year']::text[],
  unstructured_requirements = array_remove(unstructured_requirements, 'Must have financial need')
where source_url = 'https://www.jkcf.org/our-scholarships/college-scholarship-program/' and verification_status = 'verified';

update public.opportunities set
  attested_requirements = array['financial_need']::text[],
  unstructured_requirements = array_remove(unstructured_requirements, 'Must demonstrate financial need')
where source_url = 'https://ronbrown.org/ron-brown-scholarship/' and verification_status = 'verified';

update public.opportunities set
  attested_requirements = array['financial_need','college_any']::text[],
  unstructured_requirements = array_remove(unstructured_requirements, 'Must demonstrate financial need')
where source_url = 'https://www.chick-fil-a.com/community-scholars' and verification_status = 'verified';

update public.opportunities set
  attested_requirements = array['college_four_year']::text[]
where source_url = 'https://www.elks.org/scholars/scholarships/MVS.cfm' and verification_status = 'verified';

update public.opportunities set
  attested_requirements = array['college_four_year']::text[]
where source_url = 'https://haganscholarships.org/Application' and verification_status = 'verified';

update public.opportunities set
  attested_requirements = array['college_any']::text[]
where source_url = 'https://coolidgescholars.org/eligibility/' and verification_status = 'verified';

update public.opportunities set
  attested_requirements = array['college_any']::text[]
where source_url = 'https://hhfawards.hispanicheritage.org/2026/forms/welcome.php' and verification_status = 'verified';

update public.opportunities set
  attested_requirements = array['college_any']::text[]
where source_url = 'https://oppf.org/international-high-school-essay-contest/' and verification_status = 'verified';

update public.opportunities set
  citizenship_requirement = 'us_citizen_or_permanent_resident',
  unstructured_requirements = array_remove(unstructured_requirements, 'Must be a U.S. citizen or permanent resident')
where source_url = 'https://www.training.nih.gov/research-training/pb/sip/' and verification_status = 'verified';