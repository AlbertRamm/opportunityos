import { card } from "./ui";
import { safeHttpUrl } from "@/lib/opportunities";
import { createClient } from "@/lib/supabase/server";

interface AuditRow {
  id: number;
  changed_at: string;
  changed_by: string | null;
  action: "insert" | "update" | "delete";
  old_row: Record<string, unknown> | null;
  new_row: Record<string, unknown> | null;
}

const IGNORE = new Set(["updated_at"]);
function changedFields(r: AuditRow): string[] {
  if (r.action !== "update" || !r.old_row || !r.new_row) return [];
  return Object.keys(r.new_row).filter((k) => !IGNORE.has(k) && JSON.stringify(r.new_row![k]) !== JSON.stringify(r.old_row![k]));
}

/** Admin-only (RLS enforces it): where the data came from, and every change to it. */
export async function EvidencePanel({ opportunityId }: { opportunityId: string }) {
  const supabase = await createClient();
  const [{ data: admin }, { data: audit }] = await Promise.all([
    supabase.from("opportunity_admin").select("import_batch,source_evidence,review_notes").eq("opportunity_id", opportunityId).maybeSingle(),
    supabase.from("opportunity_audit").select("*").eq("opportunity_id", opportunityId).order("changed_at", { ascending: false }).limit(15),
  ]);
  const evidence = Object.entries((admin?.source_evidence ?? {}) as Record<string, { quote: string; url: string }>);

  return (
    <div className="space-y-6">
      <section className={`${card} p-6`} aria-labelledby="evidence">
        <h2 id="evidence" className="text-lg font-semibold">Source evidence</h2>
        {admin?.import_batch ? <p className="mt-1 text-sm text-muted">Imported in batch <code>{admin.import_batch}</code>. Compare each quote with the live page before verifying.</p> : <p className="mt-1 text-sm text-muted">Hand-entered (no import evidence on file).</p>}
        {evidence.length > 0 && (
          <dl className="mt-4 space-y-3 text-sm">
            {evidence.map(([field, e]) => (
              <div key={field}>
                <dt className="font-medium">{field.replace(/_/g, " ")}</dt>
                <dd className="mt-0.5 border-l-2 border-line pl-3 text-muted">
                  “{e.quote}”{" "}
                  {safeHttpUrl(e.url) && <a href={safeHttpUrl(e.url)!} target="_blank" rel="noopener noreferrer" className="whitespace-nowrap underline underline-offset-4">open source ↗</a>}
                </dd>
              </div>
            ))}
          </dl>
        )}
        {admin?.review_notes && <p className="mt-4 text-sm"><strong>Notes:</strong> {admin.review_notes}</p>}
      </section>

      <section className={`${card} p-6`} aria-labelledby="history">
        <h2 id="history" className="text-lg font-semibold">Change history</h2>
        {(audit as AuditRow[] | null)?.length ? (
          <ol className="mt-3 space-y-2 text-sm">
            {(audit as AuditRow[]).map((r) => {
              const fields = changedFields(r);
              return (
                <li key={r.id} className="flex flex-wrap gap-x-3">
                  <time dateTime={r.changed_at} className="tabular-nums text-muted">{new Date(r.changed_at).toISOString().slice(0, 16).replace("T", " ")} UTC</time>
                  <span className="font-medium">{r.action}</span>
                  <span className="text-muted">by {r.changed_by ? r.changed_by.slice(0, 8) : "system"}</span>
                  {fields.length > 0 && <span>{fields.join(", ")}</span>}
                </li>
              );
            })}
          </ol>
        ) : (
          <p className="mt-2 text-sm text-muted">No history yet.</p>
        )}
      </section>
    </div>
  );
}
