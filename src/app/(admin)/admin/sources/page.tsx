import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";
import { card } from "@/components/ui";
import { recordSourceCheck } from "./actions";

export const metadata = { title: "Source registry · Admin" };

interface SourceRow {
  id: string;
  name: string;
  owner: string;
  source_url: string;
  source_role: string;
  regions: string[];
  opportunity_types: string[];
  notes: string;
  review_interval_days: number;
  last_checked_at: string | null;
  next_review_at: string | null;
  status: string;
}

function friendlyRole(role: string) {
  return role.replaceAll("_", " ");
}

export default async function SourceRegistryPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("opportunity_sources").select("*").order("next_review_at", { ascending: true, nullsFirst: true }).limit(500);
  if (error) throw new Error(error.message);
  const sources = (data ?? []) as SourceRow[];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-semibold tracking-tight">Source registry</h1>
          <p className="mt-2 max-w-2xl text-sm text-muted">These are places to look for opportunities. A source page alone never makes a listing current; verify each program on its official page.</p>
        </div>
        <Link href="/admin" className="min-h-11 rounded-full border border-line px-4 py-2 text-sm">Back to opportunities</Link>
      </div>
      <p className="mt-4 text-sm text-muted">{sources.length} sources · Next-cycle dates and eligibility must be checked before publication.</p>
      <div className="mt-5 space-y-4">
        {sources.map((source) => (
          <section key={source.id} className={`${card} p-4 sm:p-5`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold">{source.name}</h2>
                <p className="text-sm text-muted">{source.owner} · {friendlyRole(source.source_role)} · {source.regions.join(", ") || "National"}</p>
                <p className="mt-2 max-w-3xl text-sm">{source.notes}</p>
                <p className="mt-2 text-xs text-muted">Next review: {source.next_review_at ?? "Not checked yet"} · Interval: {source.review_interval_days} days</p>
              </div>
              <a href={source.source_url} className="shrink-0 text-sm underline" target="_blank" rel="noreferrer">Open source</a>
            </div>
            <form action={recordSourceCheck} className="mt-4 grid gap-3 border-t border-line pt-4 sm:grid-cols-2">
              <input type="hidden" name="source_id" value={source.id} />
              <label className="text-sm">Review result
                <select name="outcome" defaultValue="unchanged" className="mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-3">
                  <option value="unchanged">Page checked; no material change</option>
                  <option value="changed">Page changed; listing needs review</option>
                  <option value="next_cycle_not_posted">Next cycle not posted</option>
                  <option value="unavailable">Page unavailable</option>
                </select>
              </label>
              <label className="text-sm">HTTP status (optional)
                <input name="http_status" type="number" min="100" max="599" className="mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-3" />
              </label>
              <label className="text-sm sm:col-span-2">Review note
                <input name="notes" maxLength={2000} className="mt-1 block min-h-10 w-full rounded-md border border-line bg-surface px-3" placeholder="Cycle, availability, or what needs follow-up" />
              </label>
              <button className="min-h-10 justify-self-start rounded-md bg-accent px-4 text-sm font-semibold text-white">Record check</button>
            </form>
          </section>
        ))}
      </div>
    </>
  );
}
