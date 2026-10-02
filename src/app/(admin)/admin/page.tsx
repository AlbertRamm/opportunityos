import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { rowToOpportunity, type OpportunityRow } from "@/lib/opportunities";
import { REVERIFY_AFTER_DAYS } from "@/lib/config";
import { daysBetween, formatDate, todayET } from "@/lib/dates";
import { TYPE_LABELS } from "@/lib/matching/engine";
import { card } from "@/components/ui";

export const metadata: Metadata = { title: "Admin · Opportunities" };

const VIEWS: [string, string][] = [
  ["live", "Live"],
  ["needs", "Needs re-verification"],
  ["unverified", "Unverified drafts"],
  ["expired", "Deadline passed"],
  ["archived", "Archived"],
  ["all", "All"],
];

export default async function AdminHome({ searchParams }: PageProps<"/admin">) {
  const sp = await searchParams;
  const view = typeof sp.view === "string" && VIEWS.some(([k]) => k === sp.view) ? sp.view : "live";
  const supabase = await createClient();
  const { data, error } = await supabase.from("opportunities").select("*").order("application_deadline", { ascending: true, nullsFirst: false }).limit(1000);
  if (error) throw new Error(error.message);
  const today = todayET();
  const all = (data as OpportunityRow[]).map(rowToOpportunity);

  const ageDays = (o: (typeof all)[number]) => (o.lastVerifiedAt ? daysBetween(o.lastVerifiedAt.slice(0, 10), today) : null);
  const isStale = (o: (typeof all)[number]) => o.verificationStatus === "verified" && (ageDays(o) === null || ageDays(o)! > REVERIFY_AFTER_DAYS);
  const isExpired = (o: (typeof all)[number]) => !!o.applicationDeadline && o.applicationDeadline < today;
  const live = (o: (typeof all)[number]) => !o.archivedAt && o.verificationStatus === "verified";

  const filters: Record<string, (o: (typeof all)[number]) => boolean> = {
    live: (o) => live(o) && !isExpired(o),
    needs: (o) => !o.archivedAt && (isStale(o) || o.verificationStatus === "unverified"),
    unverified: (o) => !o.archivedAt && o.verificationStatus === "unverified",
    expired: (o) => !o.archivedAt && isExpired(o),
    archived: (o) => !!o.archivedAt,
    all: () => true,
  };
  const counts = Object.fromEntries(VIEWS.map(([k]) => [k, all.filter(filters[k]).length]));
  const rows = all.filter(filters[view]);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Opportunities</h1>
        <Link href="/admin/opportunities/new" className="rounded-full bg-accent px-5 py-2.5 text-sm font-semibold text-white min-h-11 inline-flex items-center">New opportunity</Link>
      </div>
      <p className="mt-2 text-sm text-muted">
        Students only see <strong>verified, non-archived</strong> opportunities. A listing is flagged for re-verification after {REVERIFY_AFTER_DAYS} days (set <code>REVERIFY_AFTER_DAYS</code>).
      </p>
      <nav aria-label="Views" className="mt-5 flex flex-wrap gap-2">
        {VIEWS.map(([k, text]) => (
          <Link key={k} href={`/admin?view=${k}`} aria-current={view === k ? "page" : undefined}
            className={`inline-flex min-h-11 items-center rounded-full border px-4 py-2 text-sm ${view === k ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-ink"}`}>
            {text} <span className="ml-1.5 opacity-70">{counts[k]}</span>
          </Link>
        ))}
      </nav>

      <div className={`${card} mt-6 overflow-x-auto`}>
        <table className="w-full min-w-[720px] text-left text-sm">
          <caption className="sr-only">Opportunities</caption>
          <thead className="border-b border-line text-xs uppercase tracking-wider text-muted">
            <tr><th className="px-4 py-3">Title</th><th className="px-4 py-3">Type</th><th className="px-4 py-3">Deadline</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last verified</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {rows.length === 0 && <tr><td colSpan={5} className="px-4 py-10 text-center text-muted">Nothing in this view.</td></tr>}
            {rows.map((o) => {
              const age = ageDays(o);
              return (
                <tr key={o.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/opportunities/${o.id}`} className="font-medium underline-offset-4 hover:underline">{o.title}</Link>
                    <div className="text-muted">{o.organization} {o.isSample && <span className="ml-1 rounded border border-dashed border-amber-500 px-1.5 text-xs text-amber-900">SAMPLE</span>}</div>
                  </td>
                  <td className="px-4 py-3">{TYPE_LABELS[o.type]}</td>
                  <td className={`px-4 py-3 ${isExpired(o) ? "text-red-800" : ""}`}>{o.applicationDeadline ? formatDate(o.applicationDeadline) : "—"}{isExpired(o) && " (passed)"}</td>
                  <td className="px-4 py-3">
                    {o.archivedAt ? "Archived" : o.verificationStatus === "verified" ? "Verified" : <span className="font-medium text-amber-800">Unverified</span>}
                  </td>
                  <td className="px-4 py-3">
                    {o.lastVerifiedAt ? formatDate(o.lastVerifiedAt.slice(0, 10)) : "—"}
                    {isStale(o) && <span className="ml-2 rounded bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-900">STALE{age !== null ? ` · ${age}d` : ""}</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
