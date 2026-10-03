// Offline guard for data loading. Pure functions, unit-tested. Used by scripts/launch/check-batch.ts.
// Goal: make it mechanically hard to load a fact that isn't literally on the official page.

export interface Snapshot {
  url: string;
  fetched_at: string; // ISO timestamp
  status: number;
  sha256: string;
  text: string;
}

const normGlyphs = (s: string) =>
  s
    .replace(/[‘’‛]/g, "'")
    .replace(/[“”‟]/g, '"')
    .replace(/[‐-―−]/g, "-")
    .replace(/ /g, " ")
    .replace(/\s+/g, " ")
    .trim();

/** Verbatim containment, ignoring only whitespace runs and typographic quote/dash glyphs (case-sensitive). */
export function quoteInText(quote: string, text: string): boolean {
  const q = normGlyphs(quote);
  return q.length >= 8 && normGlyphs(text).includes(q);
}

export function urlKey(u: string): string {
  try {
    const p = new URL(u);
    return `${p.hostname.replace(/^www\./, "").toLowerCase()}${p.pathname.replace(/\/+$/, "")}${p.search}`;
  } catch {
    return u;
  }
}

/** Which evidence key may justify which structured field. A group key (e.g. `age`) covers all its fields. */
export const EVIDENCE_FOR: Record<string, string[]> = {
  min_age: ["min_age", "age"], max_age: ["max_age", "age"], age_reference_date: ["age_reference_date", "age"],
  min_grade: ["min_grade", "grade"], max_grade: ["max_grade", "grade"], eligible_graduation_years: ["eligible_graduation_years", "grade", "graduation"],
  allowed_states: ["allowed_states", "residency"], allowed_zips: ["allowed_zips", "residency"], allowed_counties: ["allowed_counties", "residency"],
  residency_notes: ["residency_notes", "residency"], citizenship_requirement: ["citizenship_requirement", "citizenship"],
  min_gpa: ["min_gpa", "gpa"], schedule_period: ["schedule_period", "schedule"], is_paid: ["is_paid", "pay"],
  compensation_description: ["compensation_description", "pay"], work_mode: ["work_mode", "location"],
  application_open_date: ["application_open_date", "dates"], application_deadline: ["application_deadline", "dates", "rolling"],
  program_start_date: ["program_start_date", "dates"], program_end_date: ["program_end_date", "dates"],
};

const isSet = (v: unknown) => v !== null && v !== undefined && v !== "" && !(Array.isArray(v) && v.length === 0);

/** Fields the record sets that no evidence entry supports. Empty = every decision is backed by a quote. */
export function findUnsupportedFields(row: Record<string, unknown>, evidenceKeys: string[]): string[] {
  const have = new Set(evidenceKeys);
  return Object.entries(EVIDENCE_FOR)
    .filter(([field]) => isSet(row[field]))
    .filter(([, keys]) => !keys.some((k) => have.has(k)))
    .map(([field]) => field);
}

export interface EvidenceProblem {
  field: string;
  problem: string;
}

/** Every evidence quote must appear verbatim in the snapshot of the URL it cites, and that snapshot must be fresh. */
export function checkEvidence(
  evidence: Record<string, { quote: string; url: string }>,
  snapshots: Map<string, Snapshot>,
  now: Date,
  maxAgeDays: number,
): EvidenceProblem[] {
  const problems: EvidenceProblem[] = [];
  for (const [field, e] of Object.entries(evidence)) {
    const snap = snapshots.get(urlKey(e.url));
    if (!snap) {
      problems.push({ field, problem: `no snapshot for ${e.url} (fetch it first)` });
      continue;
    }
    if (snap.status < 200 || snap.status >= 300) problems.push({ field, problem: `snapshot HTTP status ${snap.status}` });
    const ageDays = (now.getTime() - new Date(snap.fetched_at).getTime()) / 86_400_000;
    if (!(ageDays >= -0.01) || ageDays > maxAgeDays) problems.push({ field, problem: `snapshot is ${ageDays.toFixed(1)} days old (max ${maxAgeDays})` });
    if (!quoteInText(e.quote, snap.text)) problems.push({ field, problem: "quote NOT found verbatim in the fetched page" });
  }
  return problems;
}
