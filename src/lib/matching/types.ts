// Engine-level types. These are deliberately independent of the database row shapes
// (see src/lib/opportunities.ts for the mapping) so the engine stays pure and testable.

export type StateCode = "DC" | "MD" | "VA" | "OTHER";
export type PayPreference = "paid_only" | "prefer_paid" | "either";
export type WorkModePreference = "in_person" | "remote" | "either";

export const OPPORTUNITY_TYPES = [
  "internship",
  "job",
  "summer_program",
  "research",
  "scholarship",
  "apprenticeship",
  "competition",
  "volunteering",
  "pre_college",
  "other",
] as const;
export type OpportunityType = (typeof OPPORTUNITY_TYPES)[number];

export type WorkMode = "in_person" | "remote" | "hybrid";
export type SchedulePeriod = "school_year" | "summer" | "both" | "flexible";
export type CitizenshipRequirement =
  | "us_citizen"
  | "us_citizen_or_permanent_resident"
  | "work_authorization";

/** Optional self-attestations ("Match details"). null/undefined = not answered; never lowers a match. */
export type Attestation = "yes" | "no" | "not_sure" | "prefer_not";
export type GpaScale = "4.0" | "5.0" | "100" | "other";
export type GpaWeighting = "unweighted" | "weighted" | "not_sure";
export type CollegePlan = "four_year" | "two_year_or_vocational" | "undecided" | "prefer_not";
/** Opportunity rules a student can answer with a single self-attestation (see docs/DATA_MODEL_PRIVACY.md). */
export const ATTESTED_REQUIREMENTS = ["financial_need", "college_four_year", "college_any"] as const;
export type AttestedRequirement = (typeof ATTESTED_REQUIREMENTS)[number];

export interface StudentProfile {
  birthDate: string; // YYYY-MM-DD
  grade: number; // 9-12
  graduationYear: number;
  state: StateCode;
  zip: string;
  lat: number | null;
  lng: number | null;
  interests: string[]; // interest slugs
  opportunityTypes: OpportunityType[];
  payPreference: PayPreference;
  workModePreference: WorkModePreference;
  maxTravelMiles: number; // 5 | 10 | 25 | 50 (50 = "50+", i.e. no practical limit)
  availableSchoolYear: boolean;
  availableSummer: boolean;
  // Match details (all optional)
  gpaValue?: number | null;
  gpaScale?: GpaScale | null;
  gpaWeighting?: GpaWeighting | null;
  financialNeed?: Attestation | null;
  /** Coarse: "I meet U.S. citizenship or permanent-residency requirements commonly used by scholarships." */
  citizenship?: Attestation | null;
  collegePlan?: CollegePlan | null;
}

/** `null` / empty array always means "not stated" — never "open to everyone". */
export interface Opportunity {
  id: string;
  title: string;
  organization: string;
  description: string;
  applicationUrl: string | null;
  sourceUrl: string | null;
  type: OpportunityType;
  interests: string[];

  minAge: number | null;
  maxAge: number | null;
  ageReferenceDate: string | null;
  minGrade: number | null;
  maxGrade: number | null;
  eligibleGraduationYears: number[];
  allowedStates: string[];
  residencyNotes: string | null;
  allowedZips: string[];
  allowedCounties: string[];
  citizenshipRequirement: CitizenshipRequirement | null;
  minGpa: number | null;
  schedulePeriod: SchedulePeriod | null;
  additionalEligibilityNotes: string | null;
  unstructuredRequirements: string[];
  /** Rules answered by a profile self-attestation (financial need, college plans). */
  attestedRequirements: AttestedRequirement[];

  locationName: string | null;
  locationCity: string | null;
  locationState: string | null;
  locationZip: string | null;
  locationLat: number | null;
  locationLng: number | null;
  workMode: WorkMode | null;

  isPaid: boolean | null;
  compensationDescription: string | null;

  applicationOpenDate: string | null;
  applicationDeadline: string | null;
  programStartDate: string | null;
  programEndDate: string | null;

  verificationStatus: "unverified" | "verified";
  lastVerifiedAt: string | null; // ISO timestamp
  isSample: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

/**
 * strong_match      every modeled rule is known and passes, and no sponsor-specific condition remains
 * likely_match      every modeled rule is known and passes, but sponsor-specific/unmodeled conditions remain
 * eligible          like strong_match but no interest overlap
 * check_requirement at least one modeled rule can't be evaluated (missing answer, other scale, county...)
 * not_eligible      a definite failed hard rule
 */
export type MatchStatus = "strong_match" | "likely_match" | "eligible" | "check_requirement" | "not_eligible";

export type ReasonOutcome = "met" | "unmet" | "unknown" | "info";
export type ReasonGroup = "requirements" | "interests" | "preferences" | "timing" | "dataQuality";

export interface MatchReason {
  code: string;
  outcome: ReasonOutcome;
  text: string;
}

export interface MatchReasons {
  requirements: MatchReason[]; // hard eligibility checks
  interests: MatchReason[];
  preferences: MatchReason[]; // soft: never affect eligibility
  timing: MatchReason[];
  dataQuality: MatchReason[];
}

export type DeadlineState = "open" | "passed" | "none" | "not_yet_open";

export interface MatchResult {
  opportunityId: string;
  status: MatchStatus;
  matchReasons: MatchReasons;
  daysUntilDeadline: number | null;
  deadlineState: DeadlineState;
  interestOverlap: string[];
  preferenceConflicts: number;
  /** Verification older than the re-verification window. Informational only. */
  stale: boolean;
}

export interface MatchOptions {
  /** 'YYYY-MM-DD' in America/New_York. Injected so the engine is deterministic. */
  today: string;
  reverifyAfterDays?: number;
  /** slug → label, used in reason text. Falls back to a prettified slug. */
  interestLabels?: Record<string, string>;
}
