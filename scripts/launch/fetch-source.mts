// Fetches ONE official page/PDF and stores a dated, hashed text snapshot for evidence checking.
//   npx tsx scripts/launch/fetch-source.mts <url> [outDir=data/snapshots]
// Not a crawler: one URL per invocation, polite UA, no JS execution (use a browser + copy text for JS-only pages).
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { urlKey, type Snapshot } from "../../src/lib/evidence-check";

const url = process.argv[2];
const outDir = process.argv[3] ?? "data/snapshots";
if (!url || !/^(https:\/\/|http:\/\/localhost)/.test(url)) {
  console.error("usage: tsx scripts/launch/fetch-source.mts <https url> [outDir]");
  process.exit(2);
}

const ENT: Record<string, string> = { "&amp;": "&", "&lt;": "<", "&gt;": ">", "&quot;": '"', "&#39;": "'", "&apos;": "'", "&nbsp;": " ", "&ndash;": "–", "&mdash;": "—", "&rsquo;": "’", "&lsquo;": "‘", "&ldquo;": "“", "&rdquo;": "”" };
const htmlToText = (html: string) =>
  html
    .replace(/<(script|style|noscript|svg)[\s\S]*?<\/\1>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<\/(p|div|li|h[1-6]|tr|br|section|article)>|<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCodePoint(+n))
    .replace(/&[a-z]+;|&#39;/gi, (m) => ENT[m.toLowerCase()] ?? " ")
    .replace(/[ \t\f\v]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();

const res = await fetch(url, { redirect: "follow", headers: { "User-Agent": "OpportunityOS-research/0.1 (manual verification of official program pages)", Accept: "text/html,application/pdf;q=0.9,*/*;q=0.5" } });
const bytes = Buffer.from(await res.arrayBuffer());
const type = res.headers.get("content-type") ?? "";
let text: string;
if (type.includes("pdf") || url.toLowerCase().endsWith(".pdf")) {
  const dir = mkdtempSync(join(tmpdir(), "oos-"));
  const f = join(dir, "doc.pdf");
  writeFileSync(f, bytes);
  try {
    text = execFileSync("pdftotext", ["-layout", f, "-"], { encoding: "utf8", maxBuffer: 50_000_000 });
  } catch {
    console.error("✗ PDF needs `pdftotext` (poppler-utils) installed.");
    process.exit(1);
  }
} else {
  text = htmlToText(bytes.toString("utf8"));
}

const snap: Snapshot = { url: res.url || url, fetched_at: new Date().toISOString(), status: res.status, sha256: createHash("sha256").update(bytes).digest("hex"), text };
mkdirSync(outDir, { recursive: true });
const name = urlKey(snap.url).replace(/[^a-z0-9]+/gi, "_").slice(0, 120) + ".json";
writeFileSync(join(outDir, name), JSON.stringify(snap, null, 2));
console.log(`${res.ok ? "✓" : "✗"} HTTP ${res.status}, ${text.length} chars of text, sha256 ${snap.sha256.slice(0, 12)}… → ${join(outDir, name)}`);
if (text.length < 300) console.log("⚠ very little text — the page may be JavaScript-rendered; copy the text manually into the snapshot JSON.");
process.exit(res.ok ? 0 : 1);
