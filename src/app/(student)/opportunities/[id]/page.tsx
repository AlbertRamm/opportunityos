import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Header } from "@/components/Header";
import { MatchBadge } from "@/components/MatchBadge";
import { ReasonList } from "@/components/ReasonList";
import { SaveButton } from "@/components/SaveButton";
import { StatusSelect } from "@/components/StatusSelect";
import { TrackEvent } from "@/components/Track";
import { deadlineText } from "@/components/OpportunityCard";
import { button, card } from "@/components/ui";
import { getInterests, getOpportunity, listStudentOpportunities, matchAll, requireStudent } from "@/lib/data";
import { formatDate, daysBetween, todayET } from "@/lib/dates";
import { TYPE_LABELS } from "@/lib/matching/engine";
import { formatLocation, formatPay, safeHttpUrl } from "@/lib/opportunities";
import { describeRequirements } from "@/lib/requirements";

export const metadata: Metadata = { title: "Opportunity" };

export default async function OpportunityPage({ params }: PageProps<"/opportunities/[id]">) {
  const { id } = await params;
  const { profile } = await requireStudent();
  const opp = await getOpportunity(id);
  if (!opp) notFound();

  const [interests, mine] = await Promise.all([getInterests(), listStudentOpportunities()]);
  const [{ match }] = matchAll(profile, [opp], interests);
  const row = mine.find((m) => m.opportunity_id === opp.id);
  const saved = !!row?.saved_at;
  const dl = deadlineText(opp, match);
  const apply = safeHttpUrl(opp.applicationUrl);
  const source = safeHttpUrl(opp.sourceUrl);
  const reqs = describeRequirements(opp);
  const hasUncertainty = Object.values(match.matchReasons).flat().some((r) => r.outcome === "unknown");
  const verifiedDays = opp.lastVerifiedAt ? daysBetween(opp.lastVerifiedAt.slice(0, 10), todayET()) : null;
  const m = match.matchReasons;

  return (
    <>
      <Header />
      <main id="main" className="mx-auto w-full max-w-3xl flex-1 px-5 pb-20 pt-8">
        <TrackEvent name="opportunity_viewed" opportunityId={opp.id} />
        <Link href="/dashboard" className="text-sm text-muted underline underline-offset-4">← All opportunities</Link>

        {opp.isSample && (
          <p role="note" className="mt-4 rounded-lg border border-dashed border-amber-500 bg-amber-50 px-4 py-3 text-sm text-amber-950">
            <strong>Sample data.</strong> This is a fictional listing used for testing OpportunityOS. It is not a real opportunity.
          </p>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <MatchBadge status={match.status} />
          <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium">{TYPE_LABELS[opp.type]}</span>
        </div>
        <h1 className="mt-3 text-3xl font-semibold leading-tight tracking-tight sm:text-4xl">{opp.title}</h1>
        <p className="mt-1 text-lg text-muted">{opp.organization}</p>

        <div className="mt-6 flex flex-wrap items-center gap-3">
          {apply && match.deadlineState !== "passed" ? (
            <a href={`/go/${opp.id}`} target="_blank" rel="noopener noreferrer" className={button("accent") + " px-6"}>
              Apply on the official site <span aria-hidden>↗</span><span className="sr-only"> (opens in a new tab)</span>
            </a>
          ) : null}
          <SaveButton opportunityId={opp.id} saved={saved} />
        </div>
        {apply && match.deadlineState !== "passed" && (
          <p className="mt-2 text-sm text-muted">You&apos;ll apply on the organization&apos;s own website. OpportunityOS doesn&apos;t submit applications.</p>
        )}
        {row?.apply_clicked_at && (
          <p className="mt-2 text-sm text-muted">You opened the application link on {formatDate(row.apply_clicked_at.slice(0, 10))}.</p>
        )}

        {saved && (
          <div className={`${card} mt-6 p-5`}>
            <StatusSelect opportunityId={opp.id} status={row?.status ?? null} />
          </div>
        )}

        <section aria-labelledby="elig" className={`${card} mt-8 p-6`}>
          <h2 id="elig" className="text-xl font-semibold">Your eligibility</h2>
          {match.status === "not_eligible" && (
            <p className="mt-3 rounded-lg bg-neutral-100 px-4 py-3 text-sm">Based on your profile, you don&apos;t meet at least one stated requirement below.</p>
          )}
          {hasUncertainty && (
            <p role="note" className="mt-3 rounded-lg border border-amber-400 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-950">
              Some eligibility requirements could not be automatically verified. Review the official program page before applying.
            </p>
          )}
          <div className="mt-5 space-y-5">
            {m.requirements.length > 0 && <div><h3 className="mb-2 text-sm font-semibold text-muted">Requirements</h3><ReasonList reasons={m.requirements} /></div>}
            {m.timing.length > 0 && <div><h3 className="mb-2 text-sm font-semibold text-muted">Timing</h3><ReasonList reasons={m.timing} /></div>}
            {(m.interests.length > 0 || m.preferences.length > 0) && <div><h3 className="mb-2 text-sm font-semibold text-muted">Fit with your interests &amp; preferences</h3><ReasonList reasons={[...m.interests, ...m.preferences]} /></div>}
            {m.dataQuality.length > 0 && <div><h3 className="mb-2 text-sm font-semibold text-muted">About this listing</h3><ReasonList reasons={m.dataQuality} /></div>}
          </div>
          <p className="mt-5 text-xs text-muted">Computed from your profile and the requirements we recorded. It&apos;s a guide, not a guarantee — the organization makes the final call.</p>
        </section>

        <section aria-labelledby="about" className="mt-10">
          <h2 id="about" className="text-xl font-semibold">About</h2>
          <p className="mt-3 whitespace-pre-line leading-relaxed">{opp.description || "No description provided."}</p>
        </section>

        <section aria-labelledby="facts" className="mt-10">
          <h2 id="facts" className="text-xl font-semibold">Details</h2>
          <dl className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
            <Row k="Location" v={formatLocation(opp)} />
            <Row k="Compensation" v={formatPay(opp)} />
            <Row k="Application deadline" v={opp.applicationDeadline ? `${formatDate(opp.applicationDeadline)} — ${dl.text}` : "Not listed"} />
            {opp.applicationOpenDate && <Row k="Applications open" v={formatDate(opp.applicationOpenDate)} />}
            {opp.programStartDate && <Row k="Program starts" v={formatDate(opp.programStartDate)} />}
            {opp.programEndDate && <Row k="Program ends" v={formatDate(opp.programEndDate)} />}
          </dl>
        </section>

        <section aria-labelledby="reqs" className="mt-10">
          <h2 id="reqs" className="text-xl font-semibold">Stated requirements</h2>
          {reqs.length === 0 ? (
            <p className="mt-3 text-muted">No eligibility requirements were recorded. That does not mean there are none — check the official page.</p>
          ) : (
            <dl className="mt-3 divide-y divide-line rounded-2xl border border-line bg-surface">
              {reqs.map((r, i) => <Row key={i} k={r.label} v={r.value} />)}
            </dl>
          )}
        </section>

        <section aria-labelledby="src" className="mt-10">
          <h2 id="src" className="text-xl font-semibold">Source</h2>
          <p className="mt-3 text-sm">
            {source ? <a href={source} target="_blank" rel="noopener noreferrer" className="font-medium underline underline-offset-4">Official program page ↗</a> : "No source link recorded."}
          </p>
          <p className="mt-2 text-sm text-muted">
            {opp.lastVerifiedAt ? `Last verified ${formatDate(opp.lastVerifiedAt.slice(0, 10))}${verifiedDays !== null ? ` (${verifiedDays} days ago)` : ""}.` : "Not yet verified."}
            {match.stale && " This is older than we like — details may have changed, so confirm on the official page."}
          </p>
        </section>
      </main>
    </>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div className="grid gap-1 px-5 py-3 sm:grid-cols-[11rem_1fr]">
      <dt className="text-sm text-muted">{k}</dt>
      <dd className="text-sm">{v}</dd>
    </div>
  );
}
