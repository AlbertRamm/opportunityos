import { isIsoDate } from "@/lib/dates";
import { intOrNull, list, splitList, str, strOrNull } from "@/lib/forms";
import { ATTESTED_REQUIREMENTS, OPPORTUNITY_TYPES } from "@/lib/matching/types";
import { safeHttpUrl } from "@/lib/opportunities";
import { EVIDENCE_FOR, findUnsupportedFields } from "@/lib/evidence-check";

const WORK_MODES = ["in_person", "remote", "hybrid"];
const SCHEDULES = ["school_year", "summer", "both", "flexible"];
const CITIZENSHIP = ["us_citizen", "us_citizen_or_permanent_resident", "work_authorization"];

export interface ValidatedOpportunity {
  errors: Record<string, string>;
  /** DB column values (without verification fields). Coordinates may still be null: geocode afterwards. */
  row: Record<string, unknown>;
}

/**
 * Single source of truth for "is this a valid opportunity?" — used by the admin form AND the JSON importer.
 * `intent` is 'verify' when the caller wants to publish it (stricter requirements).
 */
export function validateOpportunityForm(fd: FormData, validInterests: Set<string>, intent: string): ValidatedOpportunity {
  const errors: Record<string, string> = {};

  const title = str(fd, "title");
  const organization = str(fd, "organization");
  if (!title) errors.title = "Required";
  if (!organization) errors.organization = "Required";

  const type = str(fd, "opportunity_type");
  if (!(OPPORTUNITY_TYPES as readonly string[]).includes(type)) errors.opportunity_type = "Choose a type";

  const urlField = (k: string) => {
    const raw = strOrNull(fd, k);
    if (!raw) return null;
    const ok = safeHttpUrl(raw);
    if (!ok) errors[k] = "Must be a full http(s) URL";
    return ok;
  };
  const application_url = urlField("application_url");
  const source_url = urlField("source_url");
  const source_id = strOrNull(fd, "source_id");
  if (source_id && !/^[a-z0-9][a-z0-9-]{1,79}$/.test(source_id)) errors.source_id = "Choose a listed source";

  const intField = (k: string, min: number, max: number) => {
    const n = intOrNull(fd, k);
    if (n === null) return null;
    if (Number.isNaN(n) || n < min || n > max) {
      errors[k] = `Whole number ${min}–${max}`;
      return null;
    }
    return n;
  };
  const min_age = intField("min_age", 0, 120);
  const max_age = intField("max_age", 0, 120);
  const min_grade = intField("min_grade", 1, 12);
  const max_grade = intField("max_grade", 1, 12);
  if (min_age !== null && max_age !== null && min_age > max_age) errors.max_age = "Max age is below min age";
  if (min_grade !== null && max_grade !== null && min_grade > max_grade) errors.max_grade = "Max grade is below min grade";

  const dateField = (k: string) => {
    const s = str(fd, k);
    if (!s) return null;
    if (!isIsoDate(s)) {
      errors[k] = "Invalid date";
      return null;
    }
    return s;
  };
  const age_reference_date = dateField("age_reference_date");
  const application_open_date = dateField("application_open_date");
  const application_deadline = dateField("application_deadline");
  const program_start_date = dateField("program_start_date");
  const program_end_date = dateField("program_end_date");
  if (application_open_date && application_deadline && application_open_date > application_deadline) errors.application_deadline = "Deadline is before the open date";
  if (program_start_date && program_end_date && program_start_date > program_end_date) errors.program_end_date = "Ends before it starts";

  const grad = splitList(str(fd, "eligible_graduation_years"), /[,\s]+/).map(Number);
  if (grad.some((n) => !Number.isInteger(n) || n < 2020 || n > 2100)) errors.eligible_graduation_years = "Comma-separated years, e.g. 2027, 2028";

  const states = splitList(str(fd, "allowed_states"), /[,\s]+/).map((s) => s.toUpperCase());
  if (states.some((s) => !/^[A-Z]{2}$/.test(s))) errors.allowed_states = "Two-letter codes, e.g. DC, MD, VA";
  const zips = splitList(str(fd, "allowed_zips"), /[,\s]+/);
  if (zips.some((z) => !/^\d{5}$/.test(z))) errors.allowed_zips = "5-digit ZIP codes";
  const residency_scope = str(fd, "residency_scope");
  const hasResidencyRules = states.length > 0 || zips.length > 0 || splitList(str(fd, "allowed_counties"), /\n/).length > 0;
  if (residency_scope && !["confirmed_open", "restricted"].includes(residency_scope)) errors.residency_scope = "Choose confirmed open or restricted";
  if (states.length || zips.length || splitList(str(fd, "allowed_counties"), /\n/).length) {
    if (residency_scope === "confirmed_open") errors.residency_scope = "A listing with geographic restrictions cannot be marked open to all residents";
  }

  const gpaRaw = str(fd, "min_gpa");
  const min_gpa = gpaRaw === "" ? null : Number(gpaRaw);
  if (min_gpa !== null && (!Number.isFinite(min_gpa) || min_gpa < 0 || min_gpa > 5)) errors.min_gpa = "0.00–5.00";

  const work_mode = strOrNull(fd, "work_mode");
  if (work_mode && !WORK_MODES.includes(work_mode)) errors.work_mode = "Invalid";
  const schedule_period = strOrNull(fd, "schedule_period");
  if (schedule_period && !SCHEDULES.includes(schedule_period)) errors.schedule_period = "Invalid";
  const citizenship_requirement = strOrNull(fd, "citizenship_requirement");
  if (citizenship_requirement && !CITIZENSHIP.includes(citizenship_requirement)) errors.citizenship_requirement = "Invalid";

  const attested = [...new Set(splitList(str(fd, "attested_requirements"), /[,\s]+/))];
  if (attested.some((a) => !(ATTESTED_REQUIREMENTS as readonly string[]).includes(a))) errors.attested_requirements = `Allowed: ${ATTESTED_REQUIREMENTS.join(", ")}`;

  const paid = str(fd, "is_paid");
  const is_paid = paid === "yes" ? true : paid === "no" ? false : null;
  const cost_status = str(fd, "cost_status");
  if (cost_status && !["free", "has_fee", "not_applicable"].includes(cost_status)) errors.cost_status = "Choose free, fee applies, or not applicable";
  const moneyField = (key: string) => {
    const raw = str(fd, key);
    if (!raw) return null;
    const amount = Number(raw);
    if (!Number.isFinite(amount) || amount < 0 || amount > 10000000) {
      errors[key] = "Enter an amount from 0 to 10,000,000";
      return null;
    }
    return Math.round(amount * 100) / 100;
  };
  const cost_min = moneyField("cost_min");
  const cost_max = moneyField("cost_max");
  if (cost_min !== null && cost_max !== null && cost_min > cost_max) errors.cost_max = "Maximum cost is below minimum cost";
  if (cost_status === "free" && (cost_min !== null && cost_min > 0 || cost_max !== null && cost_max > 0)) errors.cost_status = "A free listing cannot have a positive cost range";

  const location_zip = strOrNull(fd, "location_zip");
  if (location_zip && !/^\d{5}$/.test(location_zip)) errors.location_zip = "5-digit ZIP";

  const interests = list(fd, "interests");
  if (interests.some((i) => !validInterests.has(i))) errors.interests = "Unknown interest";

  const manualLat = str(fd, "location_lat");
  const manualLng = str(fd, "location_lng");
  const location_lat: number | null = manualLat ? Number(manualLat) : null;
  const location_lng: number | null = manualLng ? Number(manualLng) : null;
  if ((location_lat !== null && !Number.isFinite(location_lat)) || (location_lng !== null && !Number.isFinite(location_lng))) {
    errors.location_lat = "Latitude/longitude must be numbers";
  }

  if (intent === "verify") {
    if (!application_url) errors.application_url ??= "Required to verify";
    if (!source_url) errors.source_url ??= "Required to verify";
    if (!residency_scope && !hasResidencyRules) {
      errors.residency_scope = "Confirm whether there is a residency restriction before verifying";
    }
    if (residency_scope === "restricted" && !hasResidencyRules && !str(fd, "residency_notes")) errors.residency_scope = "Add the residency restriction or its source note before verifying";
    if (!cost_status) errors.cost_status = "Review the official page and record cost as free, fee applies, or not applicable";
  }
  const verifiedOn = str(fd, "last_verified_on");
  if (verifiedOn && !isIsoDate(verifiedOn)) errors.last_verified_on = "Invalid date";


  const row: Record<string, unknown> = {
    title,
    organization,
    description: str(fd, "description"),
    application_url,
    source_url,
    source_id,
    opportunity_type: type,
    interests,
    min_age,
    max_age,
    age_reference_date,
    min_grade,
    max_grade,
    eligible_graduation_years: grad,
    allowed_states: states,
    residency_scope: residency_scope || (hasResidencyRules ? "restricted" : "unknown"),
    residency_notes: strOrNull(fd, "residency_notes"),
    allowed_zips: zips,
    allowed_counties: splitList(str(fd, "allowed_counties"), /\n/),
    allowed_schools: splitList(str(fd, "allowed_schools"), /\n/),
    citizenship_requirement,
    min_gpa,
    schedule_period,
    additional_eligibility_notes: strOrNull(fd, "additional_eligibility_notes"),
    unstructured_requirements: splitList(str(fd, "unstructured_requirements"), /\n/),
    application_instructions: splitList(str(fd, "application_instructions"), /\n/),
    attested_requirements: attested,
    location_name: strOrNull(fd, "location_name"),
    location_city: strOrNull(fd, "location_city"),
    location_state: strOrNull(fd, "location_state")?.toUpperCase() ?? null,
    location_zip,
    location_lat: location_lat !== null ? Math.round(location_lat * 100) / 100 : null,
    location_lng: location_lng !== null ? Math.round(location_lng * 100) / 100 : null,
    work_mode,
    is_paid,
    compensation_description: strOrNull(fd, "compensation_description"),
    cost_status: cost_status || "unknown",
    cost_min,
    cost_max,
    cost_description: str(fd, "cost_description"),
    application_open_date,
    application_deadline,
    program_start_date,
    program_end_date,
  };

  return { errors, row };
}


export interface SourceEvidenceEntry {
  quote: string;
  url: string;
}

export function parseSourceEvidence(raw: string): { evidence: Record<string, SourceEvidenceEntry>; error?: string } {
  if (!raw.trim()) return { evidence: {} };
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { evidence: {}, error: "Evidence must be valid JSON mapping field names to { quote, url }." };
  }
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return { evidence: {}, error: "Evidence must be a JSON object." };
  const evidence: Record<string, SourceEvidenceEntry> = {};
  const acceptedFields = new Set([...Object.keys(EVIDENCE_FOR), ...Object.values(EVIDENCE_FOR).flat(), "current_cycle", "rolling"]);
  for (const [field, value] of Object.entries(parsed as Record<string, unknown>)) {
    if (!acceptedFields.has(field)) {
      return { evidence, error: `Unsupported evidence field: ${field}` };
    }
    if (!value || typeof value !== "object" || Array.isArray(value)) return { evidence, error: `Evidence for ${field} needs a quote and URL.` };
    const entry = value as { quote?: unknown; url?: unknown };
    const quote = typeof entry.quote === "string" ? entry.quote.trim().slice(0, 1000) : "";
    const url = typeof entry.url === "string" ? safeHttpUrl(entry.url) : null;
    if (quote.length < 8 || !url) return { evidence, error: `Evidence for ${field} needs a quote of at least 8 characters and an http(s) URL.` };
    evidence[field] = { quote, url };
  }
  return { evidence };
}

export function evidenceCoverageErrors(row: Record<string, unknown>, evidence: Record<string, SourceEvidenceEntry>): string[] {
  const errors = findUnsupportedFields(row, Object.keys(evidence));
  if (!evidence.current_cycle) errors.push("current_cycle");
  if (row.application_deadline && !evidence.application_deadline) errors.push("application_deadline");
  if (!row.application_deadline && !evidence.rolling) errors.push("rolling");
  return [...new Set(errors)];
}
