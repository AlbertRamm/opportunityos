// Offline audit of the committed launch batches against representative DMV profiles.
//   npx tsx scripts/audit/match-confidence.mts
// Reports (1) which unresolved rule types force "Needs confirmation" and (2) label counts per profile,
// without and with the optional "Match details". Reads data/batches/*.json only; no network, no database.
import fs from "node:fs";
import { parseBatch } from "../../src/lib/import-parse";
import { rowToOpportunity } from "../../src/lib/opportunities";
import { evaluateMatch } from "../../src/lib/matching/engine";
import { DEFAULT_INTERESTS } from "../../src/lib/interests";
import type { Opportunity, StudentProfile } from "../../src/lib/matching/types";

const valid = new Set(DEFAULT_INTERESTS.map((i) => i.slug));
const opps: Opportunity[] = [];
for (const f of fs.readdirSync("data/batches").filter((x) => x.endsWith(".json")).sort()) {
  let t = fs.readFileSync("data/batches/" + f, "utf8");
  if (!Array.isArray(JSON.parse(t))) t = JSON.stringify([JSON.parse(t)]);
  const r = parseBatch(t, valid);
  if (!r.ok) throw new Error(r.error);
  for (const rec of r.records) {
    const row: Record<string, unknown> = { id: rec.title, ...rec.row, verification_status: "verified", last_verified_at: "2026-10-04T12:00:00Z", is_sample: false, archived_at: null, created_at: "", updated_at: "" };
    for (const k of ["interests", "eligible_graduation_years", "allowed_states", "allowed_zips", "allowed_counties", "unstructured_requirements", "attested_requirements"]) row[k] ??= [];
    opps.push(rowToOpportunity(row as never));
  }
}
console.log("records:", opps.length);

const base = { lat: null, lng: null, opportunityTypes: [], payPreference: "either", workModePreference: "either", maxTravelMiles: 50, availableSchoolYear: true, availableSummer: true } as const;
const NONE = {};
const FULL = { gpaValue: 3.6, gpaScale: "4.0", gpaWeighting: "unweighted", financialNeed: "yes", citizenship: "yes", collegePlan: "four_year" };
const profiles: Record<string, Partial<StudentProfile>> = {
  "9th VA Fairfax": { birthDate: "2012-03-01", grade: 9, graduationYear: 2030, state: "VA", zip: "22030", interests: ["computer_science"] },
  "10th MD Montgomery": { birthDate: "2011-05-01", grade: 10, graduationYear: 2029, state: "MD", zip: "20850", interests: ["stem"] },
  "11th DC": { birthDate: "2010-02-01", grade: 11, graduationYear: 2028, state: "DC", zip: "20001", interests: ["government_policy"] },
  "12th VA Arlington": { birthDate: "2009-04-01", grade: 12, graduationYear: 2027, state: "VA", zip: "22201", interests: ["computer_science"] },
};
const mk = (p: Partial<StudentProfile>, extra: object): StudentProfile => ({ ...base, ...p, ...extra }) as StudentProfile;

// (1) census of unresolved rule types, using the 12th-grade profile (fewest grade/state exclusions)
const census: Record<string, string[]> = {};
for (const o of opps) {
  const m = evaluateMatch(mk(profiles["12th VA Arlington"], NONE), o, { today: "2026-10-04" });
  if (m.status === "not_eligible") continue;
  for (const r of m.matchReasons.requirements.filter((x) => x.outcome === "unknown")) {
    const k = /^other_requirement/.test(r.code) ? classify(r.text) : r.code;
    const list = (census[k] ??= []);
    if (!list.includes(o.title)) list.push(o.title);
  }
}
function classify(t: string): string {
  if (/citizen|permanent resident/i.test(t)) return "text: citizenship";
  if (/financial need/i.test(t)) return "text: financial need";
  if (/GPA/i.test(t)) return "text: GPA";
  if (/enroll|college-bound|plan(ning)? to attend|four-year/i.test(t)) return "text: college plans";
  return "text: sponsor-specific/other";
}
console.log("\nUnresolved rule types among records open to a 12th grader (records affected):");
for (const [k, v] of Object.entries(census).sort((a, b) => b[1].length - a[1].length)) console.log(`  ${String(v.length).padStart(2)}  ${k}`);

// (2) labels per profile and detail scenario
const SCENARIOS: Record<string, object> = {
  "no details": NONE,
  "all prefer-not-to-say": { gpaValue: null, financialNeed: "prefer_not", citizenship: "prefer_not", collegePlan: "prefer_not" },
  "all details (3.6 unweighted, need yes, citizen/PR yes, 4-year)": FULL,
  "weighted 3.2 GPA, others as FULL": { ...FULL, gpaValue: 3.2, gpaWeighting: "weighted" },
  "says NOT meeting citizenship/PR, others as FULL": { ...FULL, citizenship: "no" },
};
const tally = (s: StudentProfile) => {
  const c: Record<string, number> = {};
  for (const o of opps) { const m = evaluateMatch(s, o, { today: "2026-10-04" }); c[m.status] = (c[m.status] ?? 0) + 1; }
  const order = ["strong_match", "likely_match", "eligible", "check_requirement", "not_eligible"];
  return order.map((k) => `${k.replace("_match", "").replace("_requirement", "")}=${c[k] ?? 0}`).join(" ");
};
for (const [n, p] of Object.entries(profiles)) {
  console.log(`\n${n}`);
  for (const [sn, extra] of Object.entries(SCENARIOS)) console.log(`  ${sn.padEnd(52)} ${tally(mk(p, extra))}`);
  const moved: string[] = [];
  for (const o of opps) {
    const a = evaluateMatch(mk(p, NONE), o, { today: "2026-10-04" });
    const b = evaluateMatch(mk(p, FULL), o, { today: "2026-10-04" });
    if (a.status !== b.status) moved.push(`${o.title.slice(0, 40)}: ${a.status} -> ${b.status}`);
  }
  if (moved.length) console.log("  records moved by the details alone:\n    " + moved.join("\n    "));
}

// (3) per-record detail for one profile (set AUDIT_DETAIL=1)
if (process.env.AUDIT_DETAIL) {
  const s = mk(profiles["12th VA Arlington"], FULL);
  for (const o of opps) {
    const m = evaluateMatch(s, o, { today: "2026-10-04" });
    if (m.status === "not_eligible") continue;
    const open = m.matchReasons.requirements.filter((r) => r.outcome === "unknown").map((r) => r.code.replace("other_requirement_", "text"));
    console.log(m.status.padEnd(18), o.title.slice(0, 48).padEnd(50), open.join(","));
  }
}
