"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getInterests, requireAdmin } from "@/lib/data";
import { isIsoDate } from "@/lib/dates";
import { intOrNull, list, splitList, str, strOrNull, type FormState } from "@/lib/forms";
import { lookupZip } from "@/lib/geo";
import { OPPORTUNITY_TYPES } from "@/lib/matching/types";
import { safeHttpUrl } from "@/lib/opportunities";

export type OppFormState = FormState<Record<string, string | string[]>>;

const WORK_MODES = ["in_person", "remote", "hybrid"];
const SCHEDULES = ["school_year", "summer", "both", "flexible"];
const CITIZENSHIP = ["us_citizen", "us_citizen_or_permanent_resident", "work_authorization"];

function snapshot(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const all = fd.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = key === "interests" ? all : (all[0] ?? "");
  }
  return out;
}

export async function saveOpportunity(_prev: OppFormState, fd: FormData): Promise<OppFormState> {
  const admin = await requireAdmin();
  const values = snapshot(fd);
  const id = strOrNull(fd, "id");
  const intent = str(fd, "intent"); // save | verify | unverify
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

  const gpaRaw = str(fd, "min_gpa");
  const min_gpa = gpaRaw === "" ? null : Number(gpaRaw);
  if (min_gpa !== null && (!Number.isFinite(min_gpa) || min_gpa < 0 || min_gpa > 5)) errors.min_gpa = "0.00–5.00";

  const work_mode = strOrNull(fd, "work_mode");
  if (work_mode && !WORK_MODES.includes(work_mode)) errors.work_mode = "Invalid";
  const schedule_period = strOrNull(fd, "schedule_period");
  if (schedule_period && !SCHEDULES.includes(schedule_period)) errors.schedule_period = "Invalid";
  const citizenship_requirement = strOrNull(fd, "citizenship_requirement");
  if (citizenship_requirement && !CITIZENSHIP.includes(citizenship_requirement)) errors.citizenship_requirement = "Invalid";

  const paid = str(fd, "is_paid");
  const is_paid = paid === "yes" ? true : paid === "no" ? false : null;

  const location_zip = strOrNull(fd, "location_zip");
  if (location_zip && !/^\d{5}$/.test(location_zip)) errors.location_zip = "5-digit ZIP";

  const validInterests = new Set((await getInterests()).map((i) => i.slug));
  const interests = list(fd, "interests");
  if (interests.some((i) => !validInterests.has(i))) errors.interests = "Unknown interest";

  const manualLat = str(fd, "location_lat");
  const manualLng = str(fd, "location_lng");
  let location_lat: number | null = manualLat ? Number(manualLat) : null;
  let location_lng: number | null = manualLng ? Number(manualLng) : null;
  if ((location_lat !== null && !Number.isFinite(location_lat)) || (location_lng !== null && !Number.isFinite(location_lng))) {
    errors.location_lat = "Latitude/longitude must be numbers";
  }

  if (intent === "verify") {
    if (!application_url) errors.application_url ??= "Required to verify";
    if (!source_url) errors.source_url ??= "Required to verify";
  }
  const verifiedOn = str(fd, "last_verified_on");
  if (verifiedOn && !isIsoDate(verifiedOn)) errors.last_verified_on = "Invalid date";

  if (Object.keys(errors).length > 0) return { values, fieldErrors: errors, error: "Fix the highlighted fields." };

  if (location_zip && (location_lat === null || location_lng === null)) {
    const geo = await lookupZip(location_zip);
    if (geo) {
      location_lat = geo.lat;
      location_lng = geo.lng;
    }
  }
  if (location_lat !== null) location_lat = Math.round(location_lat * 100) / 100;
  if (location_lng !== null) location_lng = Math.round(location_lng * 100) / 100;

  const row: Record<string, unknown> = {
    title,
    organization,
    description: str(fd, "description"),
    application_url,
    source_url,
    opportunity_type: type,
    interests,
    min_age,
    max_age,
    age_reference_date,
    min_grade,
    max_grade,
    eligible_graduation_years: grad,
    allowed_states: states,
    residency_notes: strOrNull(fd, "residency_notes"),
    allowed_zips: zips,
    allowed_counties: splitList(str(fd, "allowed_counties"), /\n/),
    citizenship_requirement,
    min_gpa,
    schedule_period,
    additional_eligibility_notes: strOrNull(fd, "additional_eligibility_notes"),
    unstructured_requirements: splitList(str(fd, "unstructured_requirements"), /\n/),
    location_name: strOrNull(fd, "location_name"),
    location_city: strOrNull(fd, "location_city"),
    location_state: strOrNull(fd, "location_state")?.toUpperCase() ?? null,
    location_zip,
    location_lat,
    location_lng,
    work_mode,
    is_paid,
    compensation_description: strOrNull(fd, "compensation_description"),
    application_open_date,
    application_deadline,
    program_start_date,
    program_end_date,
  };

  if (intent === "verify") {
    row.verification_status = "verified";
    row.last_verified_at = verifiedOn ? `${verifiedOn}T12:00:00Z` : new Date().toISOString();
    row.verified_by = admin.id;
  } else if (intent === "unverify") {
    row.verification_status = "unverified";
  } else if (verifiedOn) {
    row.last_verified_at = `${verifiedOn}T12:00:00Z`;
  }

  const supabase = await createClient();
  let savedId = id;
  if (id) {
    const { error } = await supabase.from("opportunities").update(row).eq("id", id);
    if (error) return { values, error: dbMessage(error.message) };
  } else {
    const { data, error } = await supabase
      .from("opportunities")
      .insert({ ...row, created_by: admin.id })
      .select("id")
      .single();
    if (error || !data) return { values, error: dbMessage(error?.message) };
    savedId = data.id;
  }
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect(`/admin/opportunities/${savedId}?saved=${intent === "verify" ? "verified" : "1"}`);
}

function dbMessage(msg?: string): string {
  if (msg?.includes("verified_has_basics")) return "A verified opportunity needs an application URL, a source URL, and a verification date.";
  console.error("[admin] save failed", msg);
  return "Could not save. " + (msg ?? "");
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("opportunities").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath(`/admin/opportunities/${id}`);
}

/** "I re-checked the official page and nothing changed." Sets last_verified_at to now. */
export async function markReverified(id: string): Promise<void> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase
    .from("opportunities")
    .update({ verification_status: "verified", last_verified_at: new Date().toISOString(), verified_by: admin.id })
    .eq("id", id);
  if (error) throw new Error(dbMessage(error.message));
  revalidatePath("/admin");
  revalidatePath(`/admin/opportunities/${id}`);
}
