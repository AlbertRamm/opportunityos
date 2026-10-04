// Stores text you read in a browser (JS-only or bot-blocked pages, PDFs via PDFKit/pdftotext) as a dated, hashed snapshot
// in the same shape as fetch-source.mts, so check-batch.mts can verify quotes against it.
//   npx tsx scripts/launch/snapshot-from-text.mts <official-url> <text-file> [outDir=data/snapshots]
// Zero-width characters that PDF text extraction inserts are removed; nothing else is altered.
import { createHash } from "node:crypto";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { urlKey, type Snapshot } from "../../src/lib/evidence-check";

const [url, file, outDir = "data/snapshots"] = process.argv.slice(2);
if (!url || !file || !/^https:\/\//.test(url)) {
  console.error("usage: tsx scripts/launch/snapshot-from-text.mts <https official url> <text-file> [outDir]");
  process.exit(2);
}
const text = readFileSync(file, "utf8").replace(/[​‌‍⁠﻿]/g, "");
const snap: Snapshot = { url, fetched_at: new Date().toISOString(), status: 200, sha256: createHash("sha256").update(text).digest("hex"), text };
mkdirSync(outDir, { recursive: true });
const name = urlKey(url).replace(/[^a-z0-9]+/gi, "_").replace(/^_|_$/g, "").slice(0, 110) + ".json";
writeFileSync(join(outDir, name), JSON.stringify(snap, null, 2));
console.log(`✓ ${text.length} chars (browser/PDF text), sha256 ${snap.sha256.slice(0, 12)}… → ${join(outDir, name)}`);
