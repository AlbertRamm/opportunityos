begin;

-- Some existing deployments received the catalog columns before the full matching migration.
alter table public.opportunities
  add column if not exists residency_scope text not null default 'unknown'
    check (residency_scope in ('unknown', 'confirmed_open', 'restricted')),
  add column if not exists application_instructions text[] not null default '{}';

create or replace function public.import_opportunity_draft(p_listing jsonb, p_batch text, p_evidence jsonb)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  listing_id uuid;
begin
  if not coalesce(public.is_admin(), false) then
    raise insufficient_privilege using message = 'Admin access required';
  end if;
  insert into public.opportunities (
    title, organization, description, application_url, source_url,
    source_id, opportunity_type, interests, min_age, max_age,
    age_reference_date, min_grade, max_grade, eligible_graduation_years, allowed_states,
    residency_scope, residency_notes, allowed_zips, allowed_counties, allowed_schools,
    citizenship_requirement, min_gpa, schedule_period, additional_eligibility_notes, unstructured_requirements,
    application_instructions, attested_requirements, location_name, location_city, location_state,
    location_zip, location_lat, location_lng, work_mode, is_paid,
    compensation_description, cost_status, cost_min, cost_max, cost_description,
    application_open_date, application_deadline, program_start_date, program_end_date,
    created_by
  )
  select
    draft.title, draft.organization, draft.description, draft.application_url, draft.source_url,
    draft.source_id, draft.opportunity_type, draft.interests, draft.min_age, draft.max_age,
    draft.age_reference_date, draft.min_grade, draft.max_grade, draft.eligible_graduation_years, draft.allowed_states,
    draft.residency_scope, draft.residency_notes, draft.allowed_zips, draft.allowed_counties, draft.allowed_schools,
    draft.citizenship_requirement, draft.min_gpa, draft.schedule_period, draft.additional_eligibility_notes, draft.unstructured_requirements,
    draft.application_instructions, draft.attested_requirements, draft.location_name, draft.location_city, draft.location_state,
    draft.location_zip, draft.location_lat, draft.location_lng, draft.work_mode, draft.is_paid,
    draft.compensation_description, draft.cost_status, draft.cost_min, draft.cost_max, draft.cost_description,
    draft.application_open_date, draft.application_deadline, draft.program_start_date, draft.program_end_date,
    auth.uid()
  from jsonb_populate_record(null::public.opportunities, p_listing) as draft
  returning id into listing_id;

  insert into public.opportunity_admin (opportunity_id, import_batch, source_evidence)
  values (listing_id, p_batch, p_evidence);
  return listing_id;
end;
$$;

revoke all on function public.import_opportunity_draft(jsonb, text, jsonb) from public;
grant execute on function public.import_opportunity_draft(jsonb, text, jsonb) to authenticated;

commit;
