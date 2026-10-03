// Gate before importing a batch. Fails (exit 1) unless EVERY record:
//   • passes the same validation as the admin form/importer,
//   • cites evidence whose quote appears VERBATIM in a fresh snapshot of the cited official page,
//   • has evidence for every eligibility/date/pay field it sets (no inferred facts), and its source page was fetched.
//   npx tsx scripts/launch/check-batch.mts <batch.json> [snapshotsDir=data/snapshots] [maxAgeDays=7]
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { checkEvidence, findUnsupportedFields, urlKey, type Snapshot } from "../../src/lib/evidence-check";
import { parseBatch } from "../../src/lib/import-parse";
import { DEFAULT_INTERESTS } from "../../src/lib/interests";

const [batchPath, dir = "data/snapshots", maxAge = "7"] = process.argv.slice(2);
if (!batchPath) {
  console.error("usage: tsx scripts/launch/check-batch.mts <batch.json> [snapshotsDir] [maxAgeDays]");
  process.exit(2);
}
const snaps = new Map<string, Snapshot>();
for (const f of readdirSync(dir).filter((x) => x.endsWith(".json"))) {
  const s = JSON.parse(readFileSync(join(dir, f), "utf8")) as Snapshot;
  snaps.set(urlKey(s.url), s);
}
const parsed = parseBatch(readFileSync(batchPath, "utf8"), new Set(DEFAULT_INTERESTS.map((i) => i.slug)));
if (!parsed.ok) {
  console.error("✗ " + parsed.error);
  process.exit(1);
}
let bad = 0;
for (const r of parsed.records) {
  const problems: string[] = Object.entries(r.errors).map(([k, v]) => `${k}: ${v}`);
  problems.push(...checkEvidence(r.evidence, snaps, new Date(), Number(maxAge)).map((p) => `evidence.${p.field}: ${p.problem}`));
  problems.push(...findUnsupportedFields(r.row, Object.keys(r.evidence)).map((f) => `${f}: set without supporting evidence (remove it or quote the page)`));
  const src = r.row.source_url as string | null;
  if (src && !snaps.has(urlKey(src))) problems.push("source_url: no snapshot of the source page");
  console.log(`${problems.length ? "✗" : "✓"} ${r.title}`);
  for (const p of problems) console.log("    - " + p);
  if (problems.length) bad++;
}
console.log(`\n${parsed.records.length - bad}/${parsed.records.length} records pass the evidence gate.`);
process.exit(bad ? 1 : 0);
