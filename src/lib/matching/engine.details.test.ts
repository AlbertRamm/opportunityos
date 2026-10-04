import { describe, expect, it } from "vitest";
import { evaluateMatch } from "./engine";
import type { Opportunity, StudentProfile } from "./types";

const OPTS = { today: "2026-10-04", reverifyAfterDays: 30 };
const base: StudentProfile = {
  birthDate: "2009-04-01", grade: 12, graduationYear: 2027, state: "VA", zip: "22201", lat: null, lng: null,
  interests: ["computer_science"], opportunityTypes: [], payPreference: "either", workModePreference: "either",
  maxTravelMiles: 50, availableSchoolYear: true, availableSummer: true,
};
const opp = (over: Partial<Opportunity> = {}): Opportunity => ({
  id: "o", title: "T", organization: "O", description: "", applicationUrl: "https://x.example/a", sourceUrl: "https://x.example",
  type: "scholarship", interests: ["computer_science"], minAge: null, maxAge: null, ageReferenceDate: null, minGrade: 12, maxGrade: 12,
  eligibleGraduationYears: [], allowedStates: [], residencyNotes: null, allowedZips: [], allowedCounties: [], citizenshipRequirement: null,
  minGpa: null, schedulePeriod: null, additionalEligibilityNotes: null, unstructuredRequirements: [], attestedRequirements: [],
  locationName: null, locationCity: null, locationState: null, locationZip: null, locationLat: null, locationLng: null, workMode: null,
  isPaid: null, compensationDescription: null, applicationOpenDate: null, applicationDeadline: "2026-12-01", programStartDate: null,
  programEndDate: null, verificationStatus: "verified", lastVerifiedAt: "2026-10-04T12:00:00Z", isSample: false, archivedAt: null,
  createdAt: "", updatedAt: "", ...over,
});
const run = (s: Partial<StudentProfile>, o: Partial<Opportunity>) => evaluateMatch({ ...base, ...s }, opp(o), OPTS);
const codes = (r: ReturnType<typeof run>) => Object.values(r.matchReasons).flat().map((x) => `${x.outcome}:${x.code}`);

describe("GPA", () => {
  const gpa = (v: number, scale: StudentProfile["gpaScale"], w: StudentProfile["gpaWeighting"]) => ({ gpaValue: v, gpaScale: scale, gpaWeighting: w });
  it("missing GPA leaves only the GPA rule unresolved", () => {
    const r = run({}, { minGpa: 3 });
    expect(r.status).toBe("check_requirement");
    expect(codes(r)).toContain("unknown:gpa");
  });
  it("unweighted 4.0 at or above the minimum passes (counts under either reading)", () => {
    expect(run(gpa(3, "4.0", "unweighted"), { minGpa: 3 }).status).toBe("strong_match");
    expect(codes(run(gpa(3.6, "4.0", "unweighted"), { minGpa: 3 }))).toContain("met:gpa_ok");
  });
  it("unweighted below the minimum is NOT a definite fail (sponsor may count weighted)", () => {
    const r = run(gpa(2.9, "4.0", "unweighted"), { minGpa: 3 });
    expect(r.status).toBe("check_requirement");
    expect(r.status).not.toBe("not_eligible");
  });
  it("weighted below the minimum is a definite fail; weighted above is only 'confirm'", () => {
    expect(run(gpa(2.9, "4.0", "weighted"), { minGpa: 3 }).status).toBe("not_eligible");
    expect(run(gpa(3.9, "4.0", "weighted"), { minGpa: 3 }).status).toBe("check_requirement");
  });
  it("'not sure' weighting never passes or fails", () => {
    expect(run(gpa(3.9, "4.0", "not_sure"), { minGpa: 3 }).status).toBe("check_requirement");
    expect(run(gpa(2.0, "4.0", "not_sure"), { minGpa: 3 }).status).toBe("check_requirement");
  });
  it("a different scale is never compared", () => {
    for (const scale of ["5.0", "100", "other"] as const) {
      const r = run(gpa(95, scale, "unweighted"), { minGpa: 3.5 });
      expect(r.status).toBe("check_requirement");
      expect(codes(r)).toContain("unknown:gpa");
    }
  });
  it("no GPA rule on the opportunity → GPA is ignored", () => {
    expect(run(gpa(1.0, "4.0", "weighted"), {}).status).toBe("strong_match");
  });
});

describe("citizenship / residency attestation", () => {
  it("unanswered / not sure / prefer not to say leave the rule unresolved, never a failure", () => {
    for (const citizenship of [null, undefined, "not_sure", "prefer_not"] as const) {
      const r = run({ citizenship }, { citizenshipRequirement: "us_citizen_or_permanent_resident" });
      expect(r.status).toBe("check_requirement");
    }
  });
  it("yes passes a citizen-or-permanent-resident rule but says to confirm the sponsor's rule", () => {
    const r = run({ citizenship: "yes" }, { citizenshipRequirement: "us_citizen_or_permanent_resident" });
    expect(r.status).toBe("strong_match");
    expect(r.matchReasons.requirements.find((x) => x.code === "citizenship_ok")!.text).toMatch(/confirm the sponsor's exact rule/);
  });
  it("yes does NOT prove a citizens-only rule (permanent residents may say yes)", () => {
    const r = run({ citizenship: "yes" }, { citizenshipRequirement: "us_citizen" });
    expect(r.status).toBe("check_requirement");
    expect(codes(r)).toContain("unknown:citizenship");
  });
  it("yes satisfies a work-authorization rule", () => {
    expect(run({ citizenship: "yes" }, { citizenshipRequirement: "work_authorization" }).status).toBe("strong_match");
  });
  it("no is a definite fail for citizen / citizen-or-PR rules, but not for work authorization", () => {
    expect(run({ citizenship: "no" }, { citizenshipRequirement: "us_citizen" }).status).toBe("not_eligible");
    expect(run({ citizenship: "no" }, { citizenshipRequirement: "us_citizen_or_permanent_resident" }).status).toBe("not_eligible");
    expect(run({ citizenship: "no" }, { citizenshipRequirement: "work_authorization" }).status).toBe("check_requirement");
  });
  it("the answer is ignored when the opportunity has no citizenship rule", () => {
    expect(run({ citizenship: "no" }, {}).status).toBe("strong_match");
  });
});

describe("financial need attestation (subjective: never proves, never disqualifies)", () => {
  const need = { attestedRequirements: ["financial_need" as const] };
  it("yes → known, but the sponsor's own definition keeps it at likely_match", () => {
    const r = run({ financialNeed: "yes" }, need);
    expect(r.status).toBe("likely_match");
    expect(codes(r)).toContain("unknown:need_sponsor_decides");
  });
  it("no / not sure / prefer not / unanswered stay 'check requirement', never not_eligible", () => {
    for (const financialNeed of ["no", "not_sure", "prefer_not", null] as const) {
      expect(run({ financialNeed }, need).status).toBe("check_requirement");
    }
  });
  it("is irrelevant when the opportunity doesn't ask for need", () => {
    expect(run({ financialNeed: "no" }, {}).status).toBe("strong_match");
  });
});

describe("college plans attestation (an intention: resolves, never disqualifies)", () => {
  it("four-year plan satisfies both four-year and any-college rules", () => {
    expect(run({ collegePlan: "four_year" }, { attestedRequirements: ["college_four_year"] }).status).toBe("strong_match");
    expect(run({ collegePlan: "four_year" }, { attestedRequirements: ["college_any"] }).status).toBe("strong_match");
  });
  it("two-year/vocational satisfies 'any' but only raises a confirm on 'four-year'", () => {
    expect(run({ collegePlan: "two_year_or_vocational" }, { attestedRequirements: ["college_any"] }).status).toBe("strong_match");
    expect(run({ collegePlan: "two_year_or_vocational" }, { attestedRequirements: ["college_four_year"] }).status).toBe("check_requirement");
  });
  it("undecided / prefer not / unanswered never fail", () => {
    for (const collegePlan of ["undecided", "prefer_not", null] as const) {
      expect(run({ collegePlan }, { attestedRequirements: ["college_any"] }).status).toBe("check_requirement");
    }
  });
});

describe("mixed known / unknown rules and the label ladder", () => {
  const rules = { minGpa: 3, citizenshipRequirement: "us_citizen_or_permanent_resident" as const, attestedRequirements: ["college_four_year" as const] };
  it("one unanswered modeled rule keeps the whole card at check_requirement and names only that rule", () => {
    const r = run({ gpaValue: 3.5, gpaScale: "4.0", gpaWeighting: "unweighted", collegePlan: "four_year" }, rules);
    expect(r.status).toBe("check_requirement");
    const unknown = codes(r).filter((c) => c.startsWith("unknown:"));
    expect(unknown).toEqual(["unknown:citizenship"]);
    expect(codes(r)).toEqual(expect.arrayContaining(["met:gpa_ok", "met:college_ok"]));
  });
  it("all modeled rules known and passing, no sponsor text → strong_match", () => {
    const r = run({ gpaValue: 3.5, gpaScale: "4.0", gpaWeighting: "unweighted", collegePlan: "four_year", citizenship: "yes" }, rules);
    expect(r.status).toBe("strong_match");
  });
  it("all modeled rules known and passing, sponsor-specific text remains → likely_match, text listed", () => {
    const r = run(
      { gpaValue: 3.5, gpaScale: "4.0", gpaWeighting: "unweighted", collegePlan: "four_year", citizenship: "yes" },
      { ...rules, unstructuredRequirements: ["Must write an essay"] },
    );
    expect(r.status).toBe("likely_match");
    expect(r.matchReasons.requirements.filter((x) => x.outcome === "unknown").map((x) => x.text)).toEqual(["Must write an essay"]);
  });
  it("likely_match with no interest overlap is still likely_match (not downgraded to a generic label)", () => {
    const r = run({ interests: [] }, { unstructuredRequirements: ["Essay"] });
    expect(r.status).toBe("likely_match");
  });
  it("a definite failure always wins over unknowns", () => {
    expect(run({ grade: 9, citizenship: null }, { ...rules }).status).toBe("not_eligible");
  });
  it("answering never lowers a status compared with not answering (except a definite fail)", () => {
    const order = ["strong_match", "likely_match", "eligible", "check_requirement", "not_eligible"];
    const without = run({}, rules).status;
    for (const citizenship of ["not_sure", "prefer_not"] as const) {
      expect(order.indexOf(run({ citizenship, collegePlan: "prefer_not" }, rules).status)).toBeLessThanOrEqual(order.indexOf(without));
    }
  });
});
