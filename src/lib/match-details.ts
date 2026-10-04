// Optional "Match details": parsing/validation (server + tests) and small helpers. Pure; no I/O.
import { str } from "@/lib/forms";
import type { Attestation, CollegePlan, GpaScale, GpaWeighting, StudentProfile } from "@/lib/matching/types";

export const ATTESTATIONS: readonly Attestation[] = ["yes", "no", "not_sure", "prefer_not"];
export const COLLEGE_PLANS: readonly CollegePlan[] = ["four_year", "two_year_or_vocational", "undecided", "prefer_not"];
export const GPA_SCALES: readonly GpaScale[] = ["4.0", "5.0", "100", "other"];
export const GPA_WEIGHTINGS: readonly GpaWeighting[] = ["unweighted", "weighted", "not_sure"];
const GPA_MAX: Record<GpaScale, number> = { "4.0": 4, "5.0": 5, "100": 100, other: 100 };

/** Columns written to `profiles`. Every value is nullable; all-null means "no Match details". */
export interface MatchDetailsColumns {
  gpa_value: number | null;
  gpa_scale: GpaScale | null;
  gpa_weighting: GpaWeighting | null;
  attest_financial_need: Attestation | null;
  attest_citizenship: Attestation | null;
  college_plan: CollegePlan | null;
}

export const MATCH_DETAIL_FIELDS = ["gpa_value", "gpa_scale", "gpa_weighting", "attest_financial_need", "attest_citizenship", "college_plan"] as const;

const oneOf = <T extends string>(list: readonly T[], v: string): T | null => ((list as readonly string[]).includes(v) ? (v as T) : null);

/**
 * Blank everything = remove. A GPA needs its scale and type, because "3.8" means different things on different scales,
 * and we never guess whether it is weighted. Invalid input is an error, never silently dropped.
 */
export function parseMatchDetails(fd: FormData): { columns: MatchDetailsColumns; errors: Record<string, string> } {
  const errors: Record<string, string> = {};
  const raw = str(fd, "gpa_value");
  const scale = oneOf(GPA_SCALES, str(fd, "gpa_scale"));
  const weighting = oneOf(GPA_WEIGHTINGS, str(fd, "gpa_weighting"));
  let gpa_value: number | null = null;

  if (raw !== "") {
    const n = Number(raw);
    if (!Number.isFinite(n) || n < 0) errors.gpa_value = "Enter your GPA as a number, like 3.6.";
    else if (!scale) errors.gpa_scale = "Choose the scale your school uses (most use 4.0).";
    else if (n > GPA_MAX[scale]) errors.gpa_value = `On a ${scale === "other" ? "100-or-less" : scale} scale the GPA can't be above ${GPA_MAX[scale]}. If your school goes higher, choose that scale.`;
    else gpa_value = Math.round(n * 100) / 100;
    if (!weighting) errors.gpa_weighting = "Choose weighted, unweighted, or not sure.";
  }
  const hasGpa = gpa_value !== null && !errors.gpa_scale && !errors.gpa_weighting;

  return {
    errors,
    columns: {
      gpa_value: hasGpa ? gpa_value : null,
      gpa_scale: hasGpa ? scale : null,
      gpa_weighting: hasGpa ? weighting : null,
      attest_financial_need: oneOf(ATTESTATIONS, str(fd, "attest_financial_need")),
      attest_citizenship: oneOf(ATTESTATIONS, str(fd, "attest_citizenship")),
      college_plan: oneOf(COLLEGE_PLANS, str(fd, "college_plan")),
    },
  };
}

/** Row shape as read back from PostgREST (numeric arrives as a string). */
export type MatchDetailsRow = Omit<Partial<MatchDetailsColumns>, "gpa_value"> & { gpa_value?: number | string | null };

export function hasMatchDetails(p: MatchDetailsRow): boolean {
  return MATCH_DETAIL_FIELDS.some((k) => p[k] !== null && p[k] !== undefined);
}

/** DB row → matching input. Numeric columns arrive as strings from PostgREST. */
export function matchDetailsToStudent(p: MatchDetailsRow): Pick<StudentProfile, "gpaValue" | "gpaScale" | "gpaWeighting" | "financialNeed" | "citizenship" | "collegePlan"> {
  return {
    gpaValue: p.gpa_value === null || p.gpa_value === undefined ? null : Number(p.gpa_value),
    gpaScale: p.gpa_scale ?? null,
    gpaWeighting: p.gpa_weighting ?? null,
    financialNeed: p.attest_financial_need ?? null,
    citizenship: p.attest_citizenship ?? null,
    collegePlan: p.college_plan ?? null,
  };
}
