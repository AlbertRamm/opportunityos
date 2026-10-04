import { describe, expect, it } from "vitest";
import { compareMatches, evaluateMatch, isApplySoon, selectKeyReasons } from "./engine";
import type { MatchResult, Opportunity, StudentProfile } from "./types";

const TODAY = "2026-10-02";
const OPTS = { today: TODAY, reverifyAfterDays: 30 };

function student(over: Partial<StudentProfile> = {}): StudentProfile {
  return {
    birthDate: "2010-03-15", // age 16 on TODAY
    grade: 10,
    graduationYear: 2028,
    state: "DC",
    zip: "20001",
    lat: 38.91,
    lng: -77.02,
    interests: ["electrical_engineering", "computer_science"],
    opportunityTypes: ["internship", "research"],
    payPreference: "either",
    workModePreference: "either",
    maxTravelMiles: 25,
    availableSchoolYear: true,
    availableSummer: true,
    ...over,
  };
}

/** A fully-specified, verified, clean opportunity. Tests override single fields. */
function opp(over: Partial<Opportunity> = {}): Opportunity {
  return {
    id: "o1",
    title: "Test Opportunity",
    organization: "Test Org",
    description: "",
    applicationUrl: "https://example.org/apply",
    sourceUrl: "https://example.org",
    type: "internship",
    interests: ["electrical_engineering"],
    minAge: 15,
    maxAge: 18,
    ageReferenceDate: null,
    minGrade: 9,
    maxGrade: 12,
    eligibleGraduationYears: [],
    allowedStates: [],
    residencyNotes: null,
    allowedZips: [],
    allowedCounties: [],
    citizenshipRequirement: null,
    minGpa: null,
    schedulePeriod: null,
    additionalEligibilityNotes: null,
    unstructuredRequirements: [],
    attestedRequirements: [],
    locationName: null,
    locationCity: null,
    locationState: null,
    locationZip: null,
    locationLat: null,
    locationLng: null,
    workMode: null,
    isPaid: true,
    compensationDescription: null,
    applicationOpenDate: null,
    applicationDeadline: "2026-10-16", // 14 days out
    programStartDate: null,
    programEndDate: null,
    verificationStatus: "verified",
    lastVerifiedAt: "2026-09-25T12:00:00Z",
    isSample: false,
    archivedAt: null,
    createdAt: "2026-09-01T00:00:00Z",
    updatedAt: "2026-09-25T00:00:00Z",
    ...over,
  };
}

const run = (s: Partial<StudentProfile>, o: Partial<Opportunity>) => evaluateMatch(student(s), opp(o), OPTS);
const codes = (r: MatchResult) => Object.values(r.matchReasons).flat().map((x) => `${x.outcome}:${x.code}`);

describe("baseline", () => {
  it("returns strong_match when everything known passes and interests/type align", () => {
    const r = run({}, {});
    expect(r.status).toBe("strong_match");
    expect(r.daysUntilDeadline).toBe(14);
    expect(codes(r)).toEqual(
      expect.arrayContaining(["met:age_ok", "met:grade_ok", "met:interest_match", "met:paid", "met:deadline_open"]),
    );
  });

  it("returns eligible (not strong) when no interest overlap", () => {
    const r = run({}, { interests: ["finance"] });
    expect(r.status).toBe("eligible");
  });
});

describe("age", () => {
  it("accepts a correct age", () => {
    expect(codes(run({}, { minAge: 16, maxAge: 16 }))).toContain("met:age_ok");
  });
  it("is not_eligible when too young", () => {
    const r = run({}, { minAge: 17 });
    expect(r.status).toBe("not_eligible");
    expect(codes(r)).toContain("unmet:age_too_young");
  });
  it("is not_eligible when too old", () => {
    const r = run({ birthDate: "2006-01-01" }, { maxAge: 18 }); // age 20
    expect(r.status).toBe("not_eligible");
    expect(codes(r)).toContain("unmet:age_too_old");
  });
  it("handles the birthday boundary exactly", () => {
    // turns 16 on 2026-10-02 → 16 today; turns 17 tomorrow → still 16 today
    expect(run({ birthDate: "2010-10-02" }, { minAge: 16 }).status).not.toBe("not_eligible");
    expect(run({ birthDate: "2010-10-03" }, { minAge: 16 }).status).toBe("not_eligible");
  });
  it("uses the stated reference date when one is given", () => {
    const r = run({ birthDate: "2010-12-01" }, { minAge: 16, ageReferenceDate: "2027-06-01" });
    expect(r.status).not.toBe("not_eligible");
    expect(codes(r)).toContain("met:age_ok");
  });
  it("does not guess when age would change before the program starts", () => {
    // 15 today, 16 by program start, no reference date given → unknown, not ineligible
    const r = run({ birthDate: "2010-12-01" }, { minAge: 16, programStartDate: "2027-06-15" });
    expect(r.status).toBe("check_requirement");
    expect(codes(r)).toContain("unknown:age_depends_on_date");
  });
});

describe("grade and graduation year", () => {
  it("accepts correct grade", () => {
    expect(codes(run({ grade: 10 }, { minGrade: 10, maxGrade: 11 }))).toContain("met:grade_ok");
  });
  it("rejects grade below range", () => {
    const r = run({ grade: 9 }, { minGrade: 10, maxGrade: 12 });
    expect(r.status).toBe("not_eligible");
    expect(codes(r)).toContain("unmet:grade_mismatch");
  });
  it("rejects grade above range", () => {
    expect(run({ grade: 12 }, { minGrade: 9, maxGrade: 11 }).status).toBe("not_eligible");
  });
  it("supports open-ended grade bounds", () => {
    expect(run({ grade: 12 }, { minGrade: 11, maxGrade: null }).status).not.toBe("not_eligible");
  });
  it("checks eligible graduation years", () => {
    expect(run({ graduationYear: 2028 }, { minGrade: null, maxGrade: null, minAge: null, maxAge: null, eligibleGraduationYears: [2027, 2028] }).status).toBe("strong_match");
    expect(run({ graduationYear: 2029 }, { eligibleGraduationYears: [2027, 2028] }).status).toBe("not_eligible");
  });
});

describe("residency and geography", () => {
  it("matches when the student's state is allowed", () => {
    const r = run({ state: "DC" }, { allowedStates: ["DC", "MD", "VA"] });
    expect(codes(r)).toContain("met:state_ok");
    expect(r.status).toBe("strong_match");
  });
  it("is not_eligible on state mismatch", () => {
    const r = run({ state: "VA" }, { allowedStates: ["MD"] });
    expect(r.status).toBe("not_eligible");
    expect(codes(r)).toContain("unmet:state_mismatch");
  });
  it("treats an out-of-region student as failing a state restriction", () => {
    expect(run({ state: "OTHER" }, { allowedStates: ["DC", "MD", "VA"] }).status).toBe("not_eligible");
  });
  it("does not assume anything when no residency rule is stated", () => {
    const r = run({ state: "OTHER" }, {});
    expect(codes(r).some((c) => c.includes("state"))).toBe(false);
    expect(r.status).not.toBe("not_eligible");
  });
  it("passes a ZIP allow-list hit and fails a miss", () => {
    expect(codes(run({ zip: "20001" }, { allowedZips: ["20001", "20002"] }))).toContain("met:zip_ok");
    const miss = run({ zip: "20740" }, { allowedZips: ["20001", "20002"] });
    expect(miss.status).toBe("not_eligible");
    expect(codes(miss)).toContain("unmet:zip_mismatch");
  });
  it("cannot verify county restrictions from a ZIP → check_requirement, never eligible", () => {
    const r = run({ zip: "20740" }, { allowedCounties: ["Prince George's County, MD"] });
    expect(r.status).toBe("check_requirement");
    expect(codes(r)).toContain("unknown:county_unverifiable");
  });
  it("a ZIP hit satisfies an OR'd county rule", () => {
    const r = run({ zip: "20740" }, { allowedZips: ["20740"], allowedCounties: ["Prince George's County, MD"] });
    expect(r.status).toBe("strong_match");
  });
  it("flags residency notes that are not structured instead of passing silently", () => {
    const r = run({}, { residencyNotes: "Must attend a Fairfax County public school" });
    expect(r.status).toBe("check_requirement");
  });
});

describe("deadline and program dates", () => {
  it("excludes an expired deadline", () => {
    const r = run({}, { applicationDeadline: "2026-10-01" });
    expect(r.status).toBe("not_eligible");
    expect(r.deadlineState).toBe("passed");
    expect(codes(r)).toContain("unmet:deadline_passed");
  });
  it("treats the deadline day itself as still open", () => {
    const r = run({}, { applicationDeadline: TODAY });
    expect(r.status).toBe("strong_match");
    expect(r.daysUntilDeadline).toBe(0);
  });
  it("does not penalize a missing deadline but says so", () => {
    const r = run({}, { applicationDeadline: null });
    expect(r.status).toBe("strong_match");
    expect(r.deadlineState).toBe("none");
    expect(codes(r)).toContain("info:no_deadline");
  });
  it("marks not-yet-open applications without disqualifying", () => {
    const r = run({}, { applicationOpenDate: "2026-11-01", applicationDeadline: "2026-12-01" });
    expect(r.deadlineState).toBe("not_yet_open");
    expect(r.status).toBe("strong_match");
  });
  it("excludes programs that already ended", () => {
    expect(run({}, { programEndDate: "2026-09-01" }).status).toBe("not_eligible");
  });
});

describe("availability", () => {
  it("fails a summer-only program for a student unavailable in summer", () => {
    const r = run({ availableSummer: false }, { schedulePeriod: "summer" });
    expect(r.status).toBe("not_eligible");
    expect(codes(r)).toContain("unmet:availability_mismatch");
  });
  it("requires both when the program runs both", () => {
    expect(run({ availableSchoolYear: false }, { schedulePeriod: "both" }).status).toBe("not_eligible");
    expect(run({}, { schedulePeriod: "both" }).status).toBe("strong_match");
  });
  it("flexible or unstated scheduling never fails", () => {
    expect(run({ availableSummer: false, availableSchoolYear: false }, { schedulePeriod: "flexible" }).status).not.toBe("not_eligible");
  });
});

describe("unknown requirements", () => {
  it("citizenship cannot be evaluated → check_requirement", () => {
    const r = run({}, { citizenshipRequirement: "us_citizen" });
    expect(r.status).toBe("check_requirement");
    expect(codes(r)).toContain("unknown:citizenship");
  });
  it("GPA cannot be evaluated → check_requirement", () => {
    expect(run({}, { minGpa: 3 }).status).toBe("check_requirement");
  });
  it("unstructured sponsor requirements are listed and cap the card at likely_match, never strong", () => {
    const r = run({}, { unstructuredRequirements: ["Essay required", "Teacher recommendation"] });
    expect(r.status).toBe("likely_match");
    expect(codes(r).filter((c) => c.startsWith("unknown:other_requirement")).length).toBe(2);
  });
  it("an opportunity with no age/grade/class-year info can never be 'eligible'", () => {
    const r = run({}, { minAge: null, maxAge: null, minGrade: null, maxGrade: null });
    expect(r.status).toBe("check_requirement");
    expect(codes(r)).toContain("unknown:no_age_or_grade_info");
  });
  it("unverified listings are never presented as eligible", () => {
    expect(run({}, { verificationStatus: "unverified" }).status).toBe("check_requirement");
  });
  it("verified listing missing a verification date is flagged", () => {
    expect(run({}, { lastVerifiedAt: null }).status).toBe("check_requirement");
  });
  it("a known failure beats unknowns", () => {
    expect(run({ grade: 9 }, { minGrade: 11, citizenshipRequirement: "us_citizen" }).status).toBe("not_eligible");
  });
});

describe("multiple simultaneous requirements", () => {
  const strict = { minAge: 15, maxAge: 17, minGrade: 10, maxGrade: 11, allowedStates: ["DC", "MD"], schedulePeriod: "summer" as const };
  it("passes only when all pass", () => {
    expect(run({}, strict).status).toBe("strong_match");
  });
  it("one failure among many fails the whole thing and reports every failure", () => {
    const r = run({ grade: 12, state: "VA" }, strict);
    expect(r.status).toBe("not_eligible");
    const unmet = codes(r).filter((c) => c.startsWith("unmet:"));
    expect(unmet).toEqual(expect.arrayContaining(["unmet:grade_mismatch", "unmet:state_mismatch"]));
    expect(codes(r)).toContain("met:age_ok");
  });
  it("passing several known checks but one unknown → check_requirement, not eligible", () => {
    expect(run({}, { ...strict, citizenshipRequirement: "us_citizen_or_permanent_resident" }).status).toBe("check_requirement");
  });
});

describe("interests, preferences and strong match", () => {
  it("explains the interest match using labels", () => {
    const r = evaluateMatch(student(), opp(), { ...OPTS, interestLabels: { electrical_engineering: "Electrical Engineering" } });
    expect(Object.values(r.matchReasons).flat().map((x) => x.text)).toContain("Electrical Engineering matches your interests");
  });
  it("requires the opportunity type to be one the student selected for strong_match", () => {
    expect(run({ opportunityTypes: ["scholarship"] }, {}).status).toBe("eligible");
  });
  it("paid-only student + unpaid opportunity is a conflict: eligible, not strong", () => {
    const r = run({ payPreference: "paid_only" }, { isPaid: false });
    expect(r.status).toBe("eligible");
    expect(r.preferenceConflicts).toBe(1);
  });
  it("unknown pay never creates a conflict", () => {
    expect(run({ payPreference: "paid_only" }, { isPaid: null }).status).toBe("strong_match");
  });
  it("remote opportunity: no distance penalty, matches remote preference", () => {
    const r = run({ workModePreference: "remote", maxTravelMiles: 5 }, { workMode: "remote", locationLat: 40, locationLng: -100 });
    expect(r.status).toBe("strong_match");
    expect(codes(r)).toContain("met:remote");
    expect(codes(r).some((c) => c.includes("distance"))).toBe(false);
  });
  it("in-person only vs remote preference is a conflict, never a disqualifier", () => {
    const r = run({ workModePreference: "remote" }, { workMode: "in_person" });
    expect(r.status).toBe("eligible");
    expect(codes(r)).toContain("unmet:mode_conflict");
  });
  it("distance beyond the student's max travel is a conflict", () => {
    // DC → roughly Baltimore (~35 mi)
    const far = run({ maxTravelMiles: 10 }, { workMode: "in_person", locationLat: 39.29, locationLng: -76.61 });
    expect(far.status).toBe("eligible");
    expect(codes(far)).toContain("unmet:distance_conflict");
    const near = run({ maxTravelMiles: 50 }, { workMode: "in_person", locationLat: 39.29, locationLng: -76.61 });
    expect(near.status).toBe("strong_match");
  });
  it("missing coordinates → distance unknown, informational only", () => {
    const r = run({ lat: null, lng: null, maxTravelMiles: 5 }, { workMode: "in_person" });
    expect(r.status).toBe("strong_match");
    expect(codes(r)).toContain("info:distance_unknown");
  });
});

describe("staleness", () => {
  it("flags but does not downgrade old verification", () => {
    const r = run({}, { lastVerifiedAt: "2026-06-01T00:00:00Z" });
    expect(r.stale).toBe(true);
    expect(r.status).toBe("strong_match");
  });
});

describe("ordering and presentation helpers", () => {
  it("sorts strong, likely, eligible, then check, then by sooner deadline", () => {
    const mk = (o: Partial<Opportunity>) => ({ match: run({}, o) });
    const list = [
      mk({ id: "check", citizenshipRequirement: "us_citizen" }),
      mk({ id: "elig", interests: [] }),
      mk({ id: "strongLate", applicationDeadline: "2026-12-01" }),
      mk({ id: "strongSoon", applicationDeadline: "2026-10-05" }),
    ];
    // ids are not on result by opp id? evaluateMatch uses opp.id
    const sorted = [...list].sort(compareMatches).map((x) => x.match.opportunityId);
    expect(sorted).toEqual(["strongSoon", "strongLate", "elig", "check"]);
  });
  it("selectKeyReasons surfaces uncertainty and caps at 4", () => {
    const r = run({}, { citizenshipRequirement: "us_citizen", minGpa: 3.5, unstructuredRequirements: ["Essay"] });
    const key = selectKeyReasons(r);
    expect(key.length).toBeLessThanOrEqual(4);
    expect(key.some((k) => k.outcome === "unknown")).toBe(true);
  });
  it("isApplySoon only for open, not-ineligible, near deadlines", () => {
    expect(isApplySoon(run({}, { applicationDeadline: "2026-10-09" }))).toBe(true);
    expect(isApplySoon(run({}, { applicationDeadline: "2026-12-09" }))).toBe(false);
    expect(isApplySoon(run({ grade: 9 }, { minGrade: 11, applicationDeadline: "2026-10-09" }))).toBe(false);
    expect(isApplySoon(run({}, { applicationDeadline: null }))).toBe(false);
  });
});
