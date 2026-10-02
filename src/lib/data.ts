import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { rowToOpportunity, type OpportunityRow } from "@/lib/opportunities";
import { REVERIFY_AFTER_DAYS } from "@/lib/config";
import { todayET } from "@/lib/dates";
import { evaluateMatch } from "@/lib/matching/engine";
import type { MatchResult, Opportunity, OpportunityType, PayPreference, StateCode, StudentProfile, WorkModePreference } from "@/lib/matching/types";

// ------------------------------------------------------------------ auth

/** Authoritative (server-verified) user lookup. Deduped within a request. */
export const getUser = cache(async () => {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user;
});

export async function requireUser() {
  const user = await getUser();
  if (!user) redirect("/start");
  return user;
}

export const isAdmin = cache(async (): Promise<boolean> => {
  const user = await getUser();
  if (!user) return false;
  const supabase = await createClient();
  const { data } = await supabase.rpc("is_admin");
  return data === true;
});

export async function requireAdmin() {
  const user = await requireUser();
  if (!(await isAdmin())) redirect("/dashboard");
  return user;
}

// ----------------------------------------------------------------- profile

export interface ProfileRow {
  user_id: string;
  first_name: string;
  birth_date: string;
  grade: number;
  graduation_year: number;
  zip: string;
  state: StateCode;
  school_name: string;
  lat: number | string | null;
  lng: number | string | null;
  interests: string[];
  opportunity_types: OpportunityType[];
  pay_preference: PayPreference;
  work_mode_preference: WorkModePreference;
  max_travel_miles: number;
  available_school_year: boolean;
  available_summer: boolean;
  onboarding_completed_at: string | null;
}

export const getProfileRow = cache(async (): Promise<ProfileRow | null> => {
  const user = await getUser();
  if (!user) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("*").eq("user_id", user.id).maybeSingle();
  return (data as ProfileRow | null) ?? null;
});

/** Signed-in student with a completed profile, or redirect. */
export async function requireStudent() {
  const user = await requireUser();
  const profile = await getProfileRow();
  if (!profile?.onboarding_completed_at) redirect("/onboarding");
  return { user, profile };
}

export function profileToStudent(p: ProfileRow): StudentProfile {
  return {
    birthDate: p.birth_date,
    grade: p.grade,
    graduationYear: p.graduation_year,
    state: p.state,
    zip: p.zip,
    lat: p.lat === null ? null : Number(p.lat),
    lng: p.lng === null ? null : Number(p.lng),
    interests: p.interests,
    opportunityTypes: p.opportunity_types,
    payPreference: p.pay_preference,
    workModePreference: p.work_mode_preference,
    maxTravelMiles: p.max_travel_miles,
    availableSchoolYear: p.available_school_year,
    availableSummer: p.available_summer,
  };
}

// --------------------------------------------------------------- reference

export interface Interest {
  slug: string;
  label: string;
}

export const getInterests = cache(async (): Promise<Interest[]> => {
  const supabase = await createClient();
  const { data } = await supabase.from("interests").select("slug,label").eq("active", true).order("sort_order");
  return (data as Interest[] | null) ?? [];
});

export function labelMap(interests: Interest[]): Record<string, string> {
  return Object.fromEntries(interests.map((i) => [i.slug, i.label]));
}

// ----------------------------------------------------------- opportunities

/** Student-visible opportunities (RLS: verified + not archived). */
export async function listLiveOpportunities(): Promise<Opportunity[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("opportunities").select("*").limit(1000);
  if (error) throw new Error(`Could not load opportunities: ${error.message}`);
  return (data as OpportunityRow[]).map(rowToOpportunity);
}

export async function getOpportunity(id: string): Promise<Opportunity | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null;
  const supabase = await createClient();
  const { data } = await supabase.from("opportunities").select("*").eq("id", id).maybeSingle();
  return data ? rowToOpportunity(data as OpportunityRow) : null;
}

export interface Matched {
  opportunity: Opportunity;
  match: MatchResult;
}

export function matchAll(profile: ProfileRow, opps: Opportunity[], interests: Interest[]): Matched[] {
  const student = profileToStudent(profile);
  const today = todayET();
  const interestLabels = labelMap(interests);
  return opps.map((opportunity) => ({
    opportunity,
    match: evaluateMatch(student, opportunity, { today, reverifyAfterDays: REVERIFY_AFTER_DAYS, interestLabels }),
  }));
}

// ---------------------------------------------------- student ↔ opportunity

export { STATUS_LABELS, type ApplicationStatus } from "@/lib/status";
import type { ApplicationStatus } from "@/lib/status";

export interface StudentOpportunityRow {
  opportunity_id: string;
  saved_at: string | null;
  apply_clicked_at: string | null;
  status: ApplicationStatus | null;
  status_updated_at: string | null;
}

export async function listStudentOpportunities(): Promise<StudentOpportunityRow[]> {
  const user = await getUser();
  if (!user) return [];
  const supabase = await createClient();
  const { data } = await supabase
    .from("student_opportunities")
    .select("opportunity_id,saved_at,apply_clicked_at,status,status_updated_at")
    .eq("user_id", user.id);
  return (data as StudentOpportunityRow[] | null) ?? [];
}
