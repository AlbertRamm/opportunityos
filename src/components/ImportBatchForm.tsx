"use client";

import Link from "next/link";
import { useActionState } from "react";
import { importBatch, type ImportState } from "@/app/(admin)/admin/import/actions";
import { button, card, hint, input, label } from "./ui";

const BADGE: Record<string, string> = {
  ok: "bg-emerald-100 text-emerald-900",
  created: "bg-emerald-100 text-emerald-900",
  error: "bg-red-100 text-red-900",
  failed: "bg-red-100 text-red-900",
  duplicate: "bg-amber-100 text-amber-900",
};

export function ImportBatchForm() {
  const [state, action, pending] = useActionState<ImportState, FormData>(importBatch, {});
  const results = state.results ?? [];
  const okCount = results.filter((r) => r.status === "ok" || r.status === "created").length;

  return (
    <section className={`${card} mt-10 max-w-3xl p-6`} aria-labelledby="batch">
      <h2 id="batch" className="text-xl font-semibold">Import a reviewed batch (JSON)</h2>
      <p className="mt-2 text-sm text-muted">
        Creates <strong>unverified drafts</strong> with the evidence you cite (a verbatim quote + URL per decision). Nothing is shown to students until you open each draft, compare it to its source, and verify it.
        Format and rules: <code>docs/DATA_ENTRY.md</code>.
      </p>
      <form action={action} className="mt-5 space-y-4">
        <div>
          <label htmlFor="batch-name" className={label}>Batch name</label>
          <input id="batch-name" name="batch" defaultValue={state.batch} placeholder="2026-10-dmv-batch-1" className={input} />
          <p className={hint}>Recorded on each draft so you can audit where it came from.</p>
        </div>
        <div>
          <label htmlFor="batch-json" className={label}>JSON</label>
          <textarea id="batch-json" name="json" rows={12} defaultValue={state.json} spellCheck={false} className={input + " font-mono text-sm"} />
        </div>
        <div className="flex flex-wrap gap-3">
          <button name="intent" value="preview" className={button("secondary")} disabled={pending}>Validate (dry run)</button>
          <button name="intent" value="commit" className={button("accent")} disabled={pending}>Create drafts</button>
        </div>
      </form>

      {state.error && <p role="alert" className="mt-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-900">{state.error}</p>}
      {results.length > 0 && (
        <div className="mt-6" aria-live="polite">
          <h3 className="font-semibold">
            {state.mode === "commit" ? `${okCount} of ${results.length} drafts created` : `${okCount} of ${results.length} records valid (nothing saved yet)`}
          </h3>
          <ul className="mt-3 divide-y divide-line rounded-xl border border-line text-sm">
            {results.map((r) => (
              <li key={r.index} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded px-2 py-0.5 text-xs font-semibold uppercase ${BADGE[r.status]}`}>{r.status}</span>
                  <span className="font-medium">{r.title}</span>
                  {r.status === "created" && <Link className="underline underline-offset-4" href={`/admin/opportunities/${r.messages[0]}`}>Review &amp; verify →</Link>}
                </div>
                {r.status !== "created" && r.messages.length > 0 && (
                  <ul className="mt-1.5 list-disc space-y-0.5 pl-5 text-red-900">{r.messages.map((m, i) => <li key={i} className={r.status === "duplicate" ? "text-amber-900" : ""}>{m}</li>)}</ul>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
