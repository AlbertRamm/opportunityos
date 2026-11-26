import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { OpportunityCard } from "@/components/OpportunityCard";
import { StatusSelect } from "@/components/StatusSelect";
import { button, card } from "@/components/ui";
import { getInterests, listLiveOpportunities, listStudentOpportunities, matchAll, requireStudent } from "@/lib/data";
import { compareMatches } from "@/lib/matching/engine";
import { APPLY_SOON_DAYS } from "@/lib/config";
import { RemoveUnavailableSavedButton } from "@/components/RemoveUnavailableSavedButton";
import { CalendarExportButton } from "@/components/CalendarExportButton";
import { safeHttpUrl } from "@/lib/opportunities";

export const metadata: Metadata = { title: "Saved" };

const TABS: [string, string][] = [
  ["all", "All saved"],
  ["soon", "Deadline approaching"],
  ["clicked", "Application link opened"],
];

export default async function Saved({ searchParams }: PageProps<"/saved">) {
  const sp = await searchParams;
  const tab = typeof sp.tab === "string" && TABS.some(([k]) => k === sp.tab) ? sp.tab : "all";
  const { profile } = await requireStudent();
  const [opps, interests, mine] = await Promise.all([listLiveOpportunities(), getInterests(), listStudentOpportunities()]);
  const byId = new Map(matchAll(profile, opps, interests).map((m) => [m.opportunity.id, m]));

  const savedRows = mine.filter((r) => r.saved_at);
  const unavailable = savedRows.filter((r) => !byId.has(r.opportunity_id));
  const items = savedRows
    .filter((r) => byId.has(r.opportunity_id))
    .map((r) => ({ row: r, ...byId.get(r.opportunity_id)! }));

  const filtered = items.filter(({ row, match }) => {
    if (tab === "soon") return match.deadlineState === "open" && match.daysUntilDeadline !== null && match.daysUntilDeadline <= APPLY_SOON_DAYS;
    if (tab === "clicked") return !!row.apply_clicked_at;
    return true;
  });
  filtered.sort((a, b) => {
    // soonest open deadline first; closed / unlisted deadlines last
    const da = a.match.deadlineState === "open" ? a.match.daysUntilDeadline ?? 9999 : 99999;
    const db = b.match.deadlineState === "open" ? b.match.daysUntilDeadline ?? 9999 : 99999;
    return da - db || compareMatches(a, b);
  });

  return (
    <>
      <Header active="saved" />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-5 pb-20 pt-8">
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Saved</h1>
        <p className="mt-2 max-w-2xl text-muted">
          Keep track of where you are with each one. Opening an application link doesn&apos;t mean you applied — update the status yourself if you want to track it.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <nav aria-label="Saved filters" className="flex flex-wrap gap-2">
            {TABS.map(([k, text]) => (
              <Link key={k} href={k === "all" ? "/saved" : `/saved?tab=${k}`} aria-current={tab === k ? "page" : undefined}
                className={`rounded-full border px-4 py-2 text-sm min-h-11 inline-flex items-center ${tab === k ? "border-ink bg-ink text-white" : "border-line bg-surface hover:border-ink"}`}>
                {text}
              </Link>
            ))}
          </nav>
          {tab === "all" && <CalendarExportButton entries={items.flatMap(({ opportunity }) => opportunity.applicationDeadline ? [{
            id: opportunity.id, title: opportunity.title, organization: opportunity.organization,
            date: opportunity.applicationDeadline, url: safeHttpUrl(opportunity.applicationUrl),
          }] : [])} />}
        </div>

        <div className="mt-8">
          {items.length === 0 && unavailable.length === 0 ? (
            <div className={`${card} p-8 text-center`}>
              <h2 className="text-lg font-semibold">Nothing saved yet</h2>
              <p className="mx-auto mt-2 max-w-md text-muted">Tap Save on anything you might apply to. It&apos;ll show up here with its deadline.</p>
              <Link href="/dashboard" className={button("primary") + " mt-5"}>Browse opportunities</Link>
            </div>
          ) : filtered.length === 0 && tab !== "all" ? (
            <p className="text-muted">Nothing here right now.</p>
          ) : (
            <ul className="grid gap-4 lg:grid-cols-2">
              {filtered.map(({ opportunity, match, row }) => (
                <li key={opportunity.id}>
                  <OpportunityCard
                    opportunity={opportunity}
                    match={match}
                    saved
                    extra={
                      <div className="mt-4 space-y-3 border-t border-line pt-4">
                        {row.apply_clicked_at && <p className="text-sm text-muted">You opened the application link. <em>(We don&apos;t know if you applied.)</em></p>}
                        <StatusSelect opportunityId={opportunity.id} status={row.status} />
                      </div>
                    }
                  />
                </li>
              ))}
            </ul>
          )}
          {tab === "all" && unavailable.length > 0 && <section aria-labelledby="unavailable" className="mt-8">
            <h2 id="unavailable" className="text-lg font-semibold">No longer listed ({unavailable.length})</h2>
            <ul className="mt-3 space-y-3">{unavailable.map((item) => <li key={item.opportunity_id} className={`${card} flex flex-wrap items-center justify-between gap-4 p-4`}>
              <div><h3 className="font-semibold">{item.saved_title ?? "Previously saved opportunity"}</h3>
                {item.saved_organization && <p className="text-sm text-muted">{item.saved_organization}</p>}
                <p className="mt-1 text-sm text-muted">This listing is archived or being re-verified. Its latest details are unavailable.</p></div>
              <RemoveUnavailableSavedButton opportunityId={item.opportunity_id} />
            </li>)}</ul>
          </section>}
        </div>
      </main>
    </>
  );
}
