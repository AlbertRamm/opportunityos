// Turns an admin-supplied JSON batch into validated draft rows. Pure (no I/O) so it is unit-tested.
// Rule: imports can only ever create UNVERIFIED drafts. A human verifies each one in the admin UI.
import { validateOpportunityForm } from "@/lib/opportunity-validation";

export const MAX_BATCH = 100;

/** Hosts that mean "placeholder", never a real official source. */
const PLACEHOLDER_HOST = /(^|\.)(example\.(com|org|net)|localhost|test|invalid)$/i;

export interface EvidenceEntry {
  quote: string;
  url: string;
}

export interface ParsedRecord {
  index: number;
  title: string;
  row: Record<string, unknown>;
  evidence: Record<string, EvidenceEntry>;
  errors: Record<string, string>;
}

const LIST_LINES = new Set(["allowed_counties", "unstructured_requirements"]);

function toFormData(rec: Record<string, unknown>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(rec)) {
    if (k === "evidence" || v === null || v === undefined) continue;
    if (k === "interests") {
      for (const i of Array.isArray(v) ? v : String(v).split(",")) fd.append("interests", String(i).trim());
    } else if (Array.isArray(v)) {
      fd.set(k, v.map(String).join(LIST_LINES.has(k) ? "\n" : ", "));
    } else if (typeof v === "boolean" && k === "is_paid") {
      fd.set(k, v ? "yes" : "no");
    } else {
      fd.set(k, String(v));
    }
  }
  return fd;
}

export function parseBatch(
  json: string,
  validInterests: Set<string>,
): { ok: true; records: ParsedRecord[] } | { ok: false; error: string } {
  let data: unknown;
  try {
    data = JSON.parse(json);
  } catch (e) {
    return { ok: false, error: `Not valid JSON: ${(e as Error).message}` };
  }
  const list = Array.isArray(data) ? data : (data as { opportunities?: unknown })?.opportunities;
  if (!Array.isArray(list)) return { ok: false, error: 'Expected a JSON array of records (or {"opportunities": [...]}).' };
  if (list.length === 0) return { ok: false, error: "The batch is empty." };
  if (list.length > MAX_BATCH) return { ok: false, error: `At most ${MAX_BATCH} records per batch.` };

  const records: ParsedRecord[] = list.map((raw, index) => {
    const rec = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
    const { errors, row } = validateOpportunityForm(toFormData(rec), validInterests, "save");

    // Provenance is mandatory for imports: a real source page and a verbatim quote for the deadline decision.
    for (const key of ["source_url", "application_url"] as const) {
      const u = row[key] as string | null;
      if (u) {
        try {
          if (PLACEHOLDER_HOST.test(new URL(u).hostname)) errors[key] = "Placeholder/example host — not an official source";
        } catch {
          /* invalid URLs already reported */
        }
      }
    }
    if (!row.source_url) errors.source_url = "Required for imports (the official page you read)";
    if (!row.application_url) errors.application_url = "Required for imports";

    const evidence: Record<string, EvidenceEntry> = {};
    const ev = rec.evidence;
    if (ev && typeof ev === "object") {
      for (const [field, val] of Object.entries(ev as Record<string, unknown>)) {
        const e = val as { quote?: unknown; url?: unknown };
        if (typeof e?.quote === "string" && e.quote.trim() && typeof e.url === "string") {
          evidence[field] = { quote: e.quote.trim().slice(0, 1000), url: e.url };
        } else {
          errors[`evidence.${field}`] = "Each evidence entry needs {quote, url}";
        }
      }
    }
    // A listing students can act on needs its timing grounded in the source: deadline evidence (or an explicit rolling note).
    if (!evidence.application_deadline && !evidence.rolling) {
      errors["evidence.application_deadline"] = 'Provide evidence.application_deadline {quote,url} (or evidence.rolling for rolling admissions)';
    }
    if (row.application_deadline === null && !evidence.rolling) {
      errors.application_deadline = "Deadline missing (use evidence.rolling if the program is rolling)";
    }

    return { index, title: String(row.title ?? rec.title ?? `#${index + 1}`), row, evidence, errors };
  });
  return { ok: true, records };
}

/** Case-insensitive, trailing-slash-insensitive key for duplicate detection by source page. */
export function normalizeUrlKey(u: string): string {
  try {
    const p = new URL(u);
    return `${p.hostname.toLowerCase()}${p.pathname.replace(/\/+$/, "")}${p.search}`;
  } catch {
    return u.toLowerCase();
  }
}
