import { formatDate } from "@/lib/dates";
import { TYPE_LABELS } from "@/lib/matching/engine";
import type { Opportunity } from "@/lib/matching/types";

export interface RequirementLine {
  label: string;
  value: string;
}

/** The opportunity's *stated* requirements, as recorded. Absent lines mean "not recorded", not "none". */
export function describeRequirements(o: Opportunity): RequirementLine[] {
  const out: RequirementLine[] = [];
  if (o.minAge !== null || o.maxAge !== null) {
    const when = o.ageReferenceDate ? ` (as of ${formatDate(o.ageReferenceDate)})` : "";
    out.push({ label: "Age", value: `${range(o.minAge, o.maxAge)}${when}` });
  }
  if (o.minGrade !== null || o.maxGrade !== null) out.push({ label: "Grade", value: range(o.minGrade, o.maxGrade) });
  if (o.eligibleGraduationYears.length) out.push({ label: "Graduation year", value: [...o.eligibleGraduationYears].sort().join(", ") });
  if (o.allowedStates.length) out.push({ label: "Residency", value: `Residents of ${o.allowedStates.join(", ")}` });
  if (o.allowedZips.length) out.push({ label: "ZIP codes", value: o.allowedZips.join(", ") });
  if (o.allowedCounties.length) out.push({ label: "Counties", value: o.allowedCounties.join(", ") });
  if (o.residencyNotes) out.push({ label: "Residency note", value: o.residencyNotes });
  if (o.citizenshipRequirement)
    out.push({
      label: "Citizenship",
      value: { us_citizen: "U.S. citizen", us_citizen_or_permanent_resident: "U.S. citizen or permanent resident", work_authorization: "U.S. work authorization" }[o.citizenshipRequirement],
    });
  if (o.minGpa !== null) out.push({ label: "Minimum GPA", value: o.minGpa.toFixed(2) });
  if (o.schedulePeriod)
    out.push({ label: "When it runs", value: { school_year: "School year", summer: "Summer", both: "School year and summer", flexible: "Flexible" }[o.schedulePeriod] });
  o.unstructuredRequirements.forEach((r, i) => out.push({ label: i === 0 ? "Other requirements" : "", value: r }));
  if (o.additionalEligibilityNotes) out.push({ label: "Notes", value: o.additionalEligibilityNotes });
  return out;
}

function range(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return min === max ? `${min}` : `${min}–${max}`;
  if (min !== null) return `${min} and up`;
  return `up to ${max}`;
}

export { TYPE_LABELS };
