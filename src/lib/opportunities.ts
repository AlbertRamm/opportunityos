import type { CitizenshipRequirement, Opportunity, OpportunityType, SchedulePeriod, WorkMode } from "@/lib/matching/types";

/** snake_case row as returned by PostgREST (hand-written; keep in sync with the migration). */
export interface OpportunityRow {
  id: string;
  title: string;
  organization: string;
  description: string;
  application_url: string | null;
  source_url: string | null;
  opportunity_type: OpportunityType;
  interests: string[];
  min_age: number | null;
  max_age: number | null;
  age_reference_date: string | null;
  min_grade: number | null;
  max_grade: number | null;
  eligible_graduation_years: number[];
  allowed_states: string[];
  residency_notes: string | null;
  allowed_zips: string[];
  allowed_counties: string[];
  citizenship_requirement: CitizenshipRequirement | null;
  min_gpa: number | string | null;
  schedule_period: SchedulePeriod | null;
  additional_eligibility_notes: string | null;
  unstructured_requirements: string[];
  location_name: string | null;
  location_city: string | null;
  location_state: string | null;
  location_zip: string | null;
  location_lat: number | string | null;
  location_lng: number | string | null;
  work_mode: WorkMode | null;
  is_paid: boolean | null;
  compensation_description: string | null;
  application_open_date: string | null;
  application_deadline: string | null;
  program_start_date: string | null;
  program_end_date: string | null;
  verification_status: "unverified" | "verified";
  last_verified_at: string | null;
  is_sample: boolean;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
}

const num = (v: number | string | null): number | null => (v === null || v === "" ? null : Number(v));

export function rowToOpportunity(r: OpportunityRow): Opportunity {
  return {
    id: r.id,
    title: r.title,
    organization: r.organization,
    description: r.description,
    applicationUrl: r.application_url,
    sourceUrl: r.source_url,
    type: r.opportunity_type,
    interests: r.interests ?? [],
    minAge: r.min_age,
    maxAge: r.max_age,
    ageReferenceDate: r.age_reference_date,
    minGrade: r.min_grade,
    maxGrade: r.max_grade,
    eligibleGraduationYears: r.eligible_graduation_years ?? [],
    allowedStates: r.allowed_states ?? [],
    residencyNotes: r.residency_notes,
    allowedZips: r.allowed_zips ?? [],
    allowedCounties: r.allowed_counties ?? [],
    citizenshipRequirement: r.citizenship_requirement,
    minGpa: num(r.min_gpa),
    schedulePeriod: r.schedule_period,
    additionalEligibilityNotes: r.additional_eligibility_notes,
    unstructuredRequirements: r.unstructured_requirements ?? [],
    locationName: r.location_name,
    locationCity: r.location_city,
    locationState: r.location_state,
    locationZip: r.location_zip,
    locationLat: num(r.location_lat),
    locationLng: num(r.location_lng),
    workMode: r.work_mode,
    isPaid: r.is_paid,
    compensationDescription: r.compensation_description,
    applicationOpenDate: r.application_open_date,
    applicationDeadline: r.application_deadline,
    programStartDate: r.program_start_date,
    programEndDate: r.program_end_date,
    verificationStatus: r.verification_status,
    lastVerifiedAt: r.last_verified_at,
    isSample: r.is_sample,
    archivedAt: r.archived_at,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

export function formatLocation(o: Opportunity): string {
  const place = [o.locationCity, o.locationState].filter(Boolean).join(", ");
  if (o.workMode === "remote") return place ? `Remote (${place})` : "Remote";
  const base = o.locationName ? (place ? `${o.locationName} · ${place}` : o.locationName) : place || "Location not listed";
  return o.workMode === "hybrid" ? `${base} (hybrid)` : base;
}

export function formatPay(o: Opportunity): string {
  if (o.isPaid === true) return o.compensationDescription ? `Paid · ${o.compensationDescription}` : "Paid";
  if (o.isPaid === false) return "Unpaid";
  return o.compensationDescription ?? "Pay not listed";
}

/** Only http(s) URLs may ever be linked or redirected to. */
export function safeHttpUrl(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const p = new URL(u);
    return p.protocol === "http:" || p.protocol === "https:" ? p.toString() : null;
  } catch {
    return null;
  }
}
