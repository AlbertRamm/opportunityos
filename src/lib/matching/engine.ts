import { ageOn, daysBetween, formatDate } from "@/lib/dates";
import type {
  DeadlineState,
  MatchOptions,
  MatchReason,
  MatchReasons,
  MatchResult,
  MatchStatus,
  Opportunity,
  StudentProfile,
} from "./types";

/**
 * Deterministic, explainable eligibility. Pure: no I/O, no clock, no LLM.
 *
 * Rules of the road:
 *  - A requirement the opportunity states and the student fails  → not_eligible.
 *  - A requirement we can't evaluate                              → check_requirement.
 *  - Anything the opportunity does NOT state is never assumed (null ≠ "open to all").
 *  - Preferences (paid, remote, distance, type, interests) never cause not_eligible.
 */
export function evaluateMatch(
  student: StudentProfile,
  opp: Opportunity,
  options: MatchOptions,
): MatchResult {
  const { today } = options;
  const reasons: MatchReasons = {
    requirements: [],
    interests: [],
    preferences: [],
    timing: [],
    dataQuality: [],
  };
  const add = (
    group: keyof MatchReasons,
    outcome: MatchReason["outcome"],
    code: string,
    text: string,
  ) => reasons[group].push({ code, outcome, text });

  // ------------------------------------------------------------------ timing
  let deadlineState: DeadlineState = "none";
  let daysUntilDeadline: number | null = null;

  if (opp.applicationDeadline) {
    daysUntilDeadline = daysBetween(today, opp.applicationDeadline);
    if (daysUntilDeadline < 0) {
      deadlineState = "passed";
      add("timing", "unmet", "deadline_passed", `Deadline passed on ${formatDate(opp.applicationDeadline)}`);
    } else {
      deadlineState = "open";
      add("timing", "met", "deadline_open", describeDeadline(daysUntilDeadline));
    }
  } else {
    add("timing", "info", "no_deadline", "No deadline listed — confirm the application is still open");
  }

  if (opp.applicationOpenDate && daysBetween(today, opp.applicationOpenDate) > 0) {
    if (deadlineState === "open") deadlineState = "not_yet_open";
    add("timing", "info", "not_yet_open", `Applications open ${formatDate(opp.applicationOpenDate)}`);
  }

  if (opp.programEndDate && daysBetween(today, opp.programEndDate) < 0) {
    add("timing", "unmet", "program_ended", `Program ended ${formatDate(opp.programEndDate)}`);
  }

  // --------------------------------------------------------------------- age
  if (opp.minAge !== null || opp.maxAge !== null) {
    const refDate = opp.ageReferenceDate ?? today;
    const ageRef = ageOn(student.birthDate, refDate);
    const verdictRef = rangeVerdict(ageRef, opp.minAge, opp.maxAge);
    const label = opp.ageReferenceDate ? ` on ${formatDate(opp.ageReferenceDate)}` : "";
    const range = formatRange(opp.minAge, opp.maxAge);

    // No explicit reference date, but the program starts later: age may change before then.
    let ambiguousAtStart = false;
    if (!opp.ageReferenceDate && opp.programStartDate && daysBetween(today, opp.programStartDate) > 0) {
      const verdictStart = rangeVerdict(ageOn(student.birthDate, opp.programStartDate), opp.minAge, opp.maxAge);
      ambiguousAtStart = verdictStart !== verdictRef;
    }

    if (ambiguousAtStart) {
      add(
        "requirements",
        "unknown",
        "age_depends_on_date",
        `Age requirement (${range}) — you're ${ageRef} now, but it may depend on your age at the program start. Confirm how age is counted.`,
      );
    } else if (verdictRef === "ok") {
      add("requirements", "met", "age_ok", `Age ${ageRef}${label} accepted`);
    } else if (verdictRef === "below") {
      add("requirements", "unmet", "age_too_young", `Age ${ageRef}${label} is below the minimum age of ${opp.minAge}`);
    } else {
      add("requirements", "unmet", "age_too_old", `Age ${ageRef}${label} is above the maximum age of ${opp.maxAge}`);
    }
  }

  // ------------------------------------------------------------------- grade
  if (opp.minGrade !== null || opp.maxGrade !== null) {
    const verdict = rangeVerdict(student.grade, opp.minGrade, opp.maxGrade);
    if (verdict === "ok") {
      add("requirements", "met", "grade_ok", `Grade ${student.grade} accepted`);
    } else {
      add(
        "requirements",
        "unmet",
        "grade_mismatch",
        `Grade ${student.grade} is outside the accepted grades (${formatRange(opp.minGrade, opp.maxGrade)})`,
      );
    }
  }

  if (opp.eligibleGraduationYears.length > 0) {
    if (opp.eligibleGraduationYears.includes(student.graduationYear)) {
      add("requirements", "met", "grad_year_ok", `Class of ${student.graduationYear} accepted`);
    } else {
      add(
        "requirements",
        "unmet",
        "grad_year_mismatch",
        `Open to the classes of ${[...opp.eligibleGraduationYears].sort().join(", ")} only (you: ${student.graduationYear})`,
      );
    }
  }

  // --------------------------------------------------------------- residency
  const hasStateRule = opp.allowedStates.length > 0;
  const hasAreaRule = opp.allowedZips.length > 0 || opp.allowedCounties.length > 0;

  if (hasStateRule) {
    if (opp.allowedStates.includes(student.state)) {
      add("requirements", "met", "state_ok", `Available to ${student.state} residents`);
    } else {
      add(
        "requirements",
        "unmet",
        "state_mismatch",
        `Limited to residents of ${opp.allowedStates.join(", ")}${student.state === "OTHER" ? "" : ` (you: ${student.state})`}`,
      );
    }
  }

  if (hasAreaRule) {
    if (opp.allowedZips.includes(student.zip)) {
      add("requirements", "met", "zip_ok", "Your ZIP code is in the eligible area");
    } else if (opp.allowedCounties.length > 0) {
      add(
        "requirements",
        "unknown",
        "county_unverifiable",
        `Restricted to residents of ${opp.allowedCounties.join(" or ")} — confirm that you live there`,
      );
    } else {
      add("requirements", "unmet", "zip_mismatch", "Limited to specific ZIP codes that don't include yours");
    }
  }

  if (!hasStateRule && !hasAreaRule && opp.residencyNotes) {
    add("requirements", "unknown", "residency_note", `Residency note: "${opp.residencyNotes}" — confirm you qualify`);
  }

  // ------------------------------------------------------------ availability
  if (opp.schedulePeriod === "school_year" || opp.schedulePeriod === "summer" || opp.schedulePeriod === "both") {
    const needSchool = opp.schedulePeriod !== "summer";
    const needSummer = opp.schedulePeriod !== "school_year";
    const ok = (!needSchool || student.availableSchoolYear) && (!needSummer || student.availableSummer);
    const when = { school_year: "during the school year", summer: "during the summer", both: "during the school year and summer" }[
      opp.schedulePeriod
    ];
    if (ok) {
      add("requirements", "met", "availability_ok", `Runs ${when} — matches your availability`);
    } else {
      add("requirements", "unmet", "availability_mismatch", `Runs ${when}, which doesn't match your availability`);
    }
  }

  // ------------------------------- rules a student can answer (optional Match details)
  if (opp.citizenshipRequirement) evaluateCitizenship(student, opp, add);
  if (opp.minGpa !== null) evaluateGpa(student, opp.minGpa, add);
  for (const req of opp.attestedRequirements) {
    if (req === "financial_need") evaluateNeed(student, add);
    else evaluateCollegePlan(student, req, add);
  }
  opp.unstructuredRequirements.forEach((req, i) =>
    add("requirements", "unknown", `other_requirement_${i}`, req),
  );

  const statesAgeOrGrade =
    opp.minAge !== null ||
    opp.maxAge !== null ||
    opp.minGrade !== null ||
    opp.maxGrade !== null ||
    opp.eligibleGraduationYears.length > 0;
  if (!statesAgeOrGrade) {
    add(
      "requirements",
      "unknown",
      "no_age_or_grade_info",
      "No age, grade, or class-year requirement is recorded — confirm who can apply",
    );
  }

  // ------------------------------------------------------------ data quality
  let stale = false;
  if (opp.verificationStatus !== "verified") {
    add("dataQuality", "unknown", "unverified", "This listing hasn't been verified by our team yet");
  } else if (!opp.lastVerifiedAt) {
    add("dataQuality", "unknown", "no_verified_date", "No verification date is recorded for this listing");
  } else if (options.reverifyAfterDays !== undefined) {
    const verifiedDay = opp.lastVerifiedAt.slice(0, 10);
    const age = daysBetween(verifiedDay, today);
    if (age > options.reverifyAfterDays) {
      stale = true;
      add("dataQuality", "info", "stale", `Details last verified ${age} days ago — confirm on the official page`);
    }
  }

  // --------------------------------------------------------------- interests
  const labels = options.interestLabels ?? {};
  const label = (slug: string) => labels[slug] ?? prettifySlug(slug);
  const interestOverlap = opp.interests.filter((i) => student.interests.includes(i));
  if (interestOverlap.length > 0) {
    add("interests", "met", "interest_match", `${interestOverlap.map(label).join(", ")} matches your interests`);
  } else if (opp.interests.length > 0) {
    add("interests", "info", "interest_no_match", "Doesn't match the interests you selected");
  }

  // ------------------------------------------------------------- preferences
  let preferenceConflicts = 0;
  const conflict = (code: string, text: string) => {
    preferenceConflicts += 1;
    add("preferences", "unmet", code, text);
  };

  const typeSelected = student.opportunityTypes.length === 0 || student.opportunityTypes.includes(opp.type);
  if (student.opportunityTypes.length > 0) {
    if (typeSelected) add("preferences", "met", "type_match", `${typeLabel(opp.type)} is a type you're looking for`);
    else add("preferences", "info", "type_other", `${typeLabel(opp.type)} isn't one of the types you selected`);
  }

  if (opp.isPaid === true) {
    add("preferences", "met", "paid", "Paid opportunity");
  } else if (opp.isPaid === false) {
    if (student.payPreference === "paid_only") conflict("unpaid_conflict", "Unpaid — you said paid only");
    else if (student.payPreference === "prefer_paid") conflict("unpaid_conflict", "Unpaid — you prefer paid");
    else add("preferences", "info", "unpaid", "Unpaid");
  }

  if (opp.workMode) {
    const pref = student.workModePreference;
    if (opp.workMode === "remote") {
      if (pref === "in_person") conflict("mode_conflict", "Remote — you prefer in-person");
      else add("preferences", pref === "remote" ? "met" : "info", "remote", pref === "remote" ? "Remote — matches your preference" : "Remote");
    } else if (opp.workMode === "in_person") {
      if (pref === "remote") conflict("mode_conflict", "In-person only — you prefer remote");
    }
  }

  const needsTravel = opp.workMode !== "remote" && student.workModePreference !== "remote";
  if (needsTravel && student.maxTravelMiles < 50) {
    if (student.lat !== null && student.lng !== null && opp.locationLat !== null && opp.locationLng !== null) {
      const miles = Math.round(haversineMiles(student.lat, student.lng, opp.locationLat, opp.locationLng));
      if (miles > student.maxTravelMiles) {
        conflict("distance_conflict", `About ${miles} mi away (straight-line) — you prefer ${student.maxTravelMiles} mi or less`);
      } else {
        add("preferences", "met", "distance_ok", `About ${miles} mi away (straight-line)`);
      }
    } else if (opp.workMode !== null) {
      add("preferences", "info", "distance_unknown", "Distance from you couldn't be calculated");
    }
  }

  // ------------------------------------------------------------------ status
  const all = Object.values(reasons).flat();
  const hasUnmet = reasons.requirements.concat(reasons.timing).some((r) => r.outcome === "unmet");
  const unknown = all.filter((r) => r.outcome === "unknown");
  const modeledUnknown = unknown.some((r) => !isSponsorCondition(r.code));
  const conditionsRemain = unknown.some((r) => isSponsorCondition(r.code));

  let status: MatchStatus;
  if (hasUnmet) status = "not_eligible";
  else if (modeledUnknown) status = "check_requirement";
  else if (conditionsRemain) status = "likely_match";
  else if (interestOverlap.length > 0 && typeSelected && preferenceConflicts === 0) status = "strong_match";
  else status = "eligible";

  return {
    opportunityId: opp.id,
    status,
    matchReasons: reasons,
    daysUntilDeadline,
    deadlineState,
    interestOverlap,
    preferenceConflicts,
    stale,
  };
}

// ------------------------------------------------------------------ ordering

const STATUS_ORDER: Record<MatchStatus, number> = {
  strong_match: 0,
  likely_match: 1,
  eligible: 2,
  check_requirement: 3,
  not_eligible: 4,
};

/** Best first: status, then fewer preference conflicts, more interest overlap, sooner deadline. */
export function compareMatches(
  a: { match: MatchResult },
  b: { match: MatchResult },
): number {
  const A = a.match;
  const B = b.match;
  if (STATUS_ORDER[A.status] !== STATUS_ORDER[B.status]) return STATUS_ORDER[A.status] - STATUS_ORDER[B.status];
  if (A.preferenceConflicts !== B.preferenceConflicts) return A.preferenceConflicts - B.preferenceConflicts;
  if (A.interestOverlap.length !== B.interestOverlap.length) return B.interestOverlap.length - A.interestOverlap.length;
  const da = A.daysUntilDeadline ?? Number.POSITIVE_INFINITY;
  const db = B.daysUntilDeadline ?? Number.POSITIVE_INFINITY;
  return da - db;
}

/**
 * 2–4 reasons for compact cards. Problems first (a student must see what is uncertain),
 * then what matched. Never more than `max`.
 */
export function selectKeyReasons(result: MatchResult, max = 4): MatchReason[] {
  const r = result.matchReasons;
  const all = [r.requirements, r.timing, r.dataQuality].flat();
  const unmet = all.filter((x) => x.outcome === "unmet");
  const unknown = all.filter((x) => x.outcome === "unknown");
  const metReqs = r.requirements.filter((x) => x.outcome === "met");
  const picked: MatchReason[] = [
    ...unmet,
    ...unknown.slice(0, 2),
    ...r.interests.filter((x) => x.outcome === "met"),
    ...metReqs.slice(0, 2),
    ...r.preferences.filter((x) => x.outcome === "met" || x.outcome === "unmet"),
    ...r.timing.filter((x) => x.outcome === "met"),
  ];
  const seen = new Set<string>();
  return picked
    .filter((x) => (seen.has(x.code) ? false : (seen.add(x.code), true)))
    .slice(0, max);
}

/** Convenience for UIs: unmet/unknown first, then met, then info. */
export function groupedReasons(result: MatchResult): MatchReason[] {
  const order: Record<MatchReason["outcome"], number> = { unmet: 0, unknown: 1, met: 2, info: 3 };
  return Object.values(result.matchReasons)
    .flat()
    .sort((a: MatchReason, b: MatchReason) => order[a.outcome] - order[b.outcome]);
}


// ------------------------------------------------ self-attested rule evaluation

type Add = (group: keyof MatchReasons, outcome: MatchReason["outcome"], code: string, text: string) => void;

/**
 * Unresolved items that are the sponsor's own conditions (free-text rules, discretionary judgments), not a modeled
 * rule we failed to evaluate. They keep a card at "Likely Match" instead of "Strong Match", but never at
 * "Check Requirement" by themselves.
 */
export function isSponsorCondition(code: string): boolean {
  return code.startsWith("other_requirement_") || code === "need_sponsor_decides";
}

const CITIZEN_LABEL = {
  us_citizen: "U.S. citizenship",
  us_citizen_or_permanent_resident: "U.S. citizenship or permanent residency",
  work_authorization: "U.S. work authorization",
} as const;
const HINT = "add it under Match details (optional) or confirm with the sponsor";

function evaluateCitizenship(student: StudentProfile, opp: Opportunity, add: Add) {
  const req = opp.citizenshipRequirement!;
  const what = CITIZEN_LABEL[req];
  const a = student.citizenship ?? null;
  if (a === "yes") {
    if (req === "us_citizen") {
      add("requirements", "unknown", "citizenship", `Requires U.S. citizenship specifically. You said you meet citizenship or permanent-residency requirements, but permanent residents may not qualify here, so confirm the sponsor's exact rule`);
    } else {
      add("requirements", "met", "citizenship_ok", `Requires ${what}. You said you meet U.S. citizenship or permanent-residency requirements; confirm the sponsor's exact rule`);
    }
  } else if (a === "no") {
    if (req === "work_authorization") {
      add("requirements", "unknown", "citizenship", `Requires ${what}. You said you don't meet citizenship or permanent-residency requirements, but work authorization can come from other statuses, so confirm the sponsor's exact rule`);
    } else {
      add("requirements", "unmet", "citizenship_mismatch", `Requires ${what}; you said you don't meet U.S. citizenship or permanent-residency requirements`);
    }
  } else {
    add("requirements", "unknown", "citizenship", `Requires ${what}. We haven't asked for your status, so ${HINT}`);
  }
}

function evaluateGpa(student: StudentProfile, min: number, add: Add) {
  const minText = min.toFixed(2);
  const v = student.gpaValue ?? null;
  if (v === null) {
    add("requirements", "unknown", "gpa", `Minimum GPA ${minText} (4.0 scale). We don't have your GPA, so ${HINT}`);
    return;
  }
  if (student.gpaScale !== "4.0") {
    add("requirements", "unknown", "gpa", `Minimum GPA ${minText} (4.0 scale). Your GPA is on a different scale, so we can't compare it; confirm with the sponsor`);
    return;
  }
  const mine = v.toFixed(2);
  const w = student.gpaWeighting ?? "not_sure";
  if (w === "unweighted") {
    if (v >= min) add("requirements", "met", "gpa_ok", `Minimum GPA ${minText}; your unweighted GPA of ${mine} meets it`);
    else add("requirements", "unknown", "gpa", `Minimum GPA ${minText}; your unweighted GPA is ${mine}. It may still qualify if the sponsor counts weighted GPA, so confirm`);
  } else if (w === "weighted") {
    // A weighted GPA is never lower than the unweighted one, so below-minimum is a definite miss; at-or-above is not proof.
    if (v < min) add("requirements", "unmet", "gpa_below", `Minimum GPA ${minText}; your weighted GPA of ${mine} is below it`);
    else add("requirements", "unknown", "gpa", `Minimum GPA ${minText}; your weighted GPA is ${mine}, which counts only if the sponsor accepts weighted GPA. Confirm`);
  } else {
    add("requirements", "unknown", "gpa", `Minimum GPA ${minText}; you're not sure whether your ${mine} is weighted, and sponsors differ. Confirm`);
  }
}

/** Financial need is defined by each sponsor, so a student's answer can never prove it, and "no" never disqualifies. */
function evaluateNeed(student: StudentProfile, add: Add) {
  const a = student.financialNeed ?? null;
  if (a === "yes") {
    add("requirements", "unknown", "need_sponsor_decides", "Requires financial need. You said you may have need; the sponsor decides using its own definition");
  } else if (a === "no") {
    add("requirements", "unknown", "need", "Requires financial need. You said you don't expect to have need, so check the sponsor's definition before applying");
  } else {
    add("requirements", "unknown", "need", `Requires financial need as the sponsor defines it. ${a === null ? "We haven't asked, so " + HINT : "You chose not to say, so confirm with the sponsor"}`);
  }
}

/** College plans are intentions, so they can resolve a rule as "known" but never disqualify. */
function evaluateCollegePlan(student: StudentProfile, req: "college_four_year" | "college_any", add: Add) {
  const need = req === "college_four_year" ? "plans to attend a four-year college or university" : "plans to attend college";
  const a = student.collegePlan ?? null;
  if (a === "four_year" || (a === "two_year_or_vocational" && req === "college_any")) {
    add("requirements", "met", "college_ok", `Requires ${need}. Your college plans match`);
  } else if (a === "two_year_or_vocational") {
    add("requirements", "unknown", "college_plan", `Requires ${need}. You said two-year or vocational; plans can change, so confirm`);
  } else if (a === "undecided") {
    add("requirements", "unknown", "college_plan", `Requires ${need}. You said you're undecided, so confirm before applying`);
  } else {
    add("requirements", "unknown", "college_plan", `Requires ${need}. ${a === null ? "We haven't asked, so " + HINT : "You chose not to say, so confirm with the sponsor"}`);
  }
}

// ------------------------------------------------------------------- helpers

type Verdict = "ok" | "below" | "above";

function rangeVerdict(value: number, min: number | null, max: number | null): Verdict {
  if (min !== null && value < min) return "below";
  if (max !== null && value > max) return "above";
  return "ok";
}

function formatRange(min: number | null, max: number | null): string {
  if (min !== null && max !== null) return min === max ? `${min}` : `${min}–${max}`;
  if (min !== null) return `${min} and up`;
  if (max !== null) return `up to ${max}`;
  return "any";
}

function describeDeadline(days: number): string {
  if (days === 0) return "Deadline is today";
  if (days === 1) return "1 day until deadline";
  return `${days} days until deadline`;
}

export function typeLabel(type: Opportunity["type"]): string {
  return TYPE_LABELS[type];
}

export const TYPE_LABELS: Record<Opportunity["type"], string> = {
  internship: "Internship",
  job: "Job",
  summer_program: "Summer program",
  research: "Research",
  scholarship: "Scholarship",
  apprenticeship: "Apprenticeship",
  competition: "Competition",
  volunteering: "Volunteering / service",
  pre_college: "Pre-college program",
  other: "Other",
};

function prettifySlug(slug: string): string {
  return slug.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
}

export function haversineMiles(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Deadline within N days (inclusive), still open. Used by "Apply Soon". */
export function isApplySoon(result: MatchResult, withinDays = 14): boolean {
  return (
    result.status !== "not_eligible" &&
    result.deadlineState === "open" &&
    result.daysUntilDeadline !== null &&
    result.daysUntilDeadline <= withinDays
  );
}
