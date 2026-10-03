import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { OpportunityCard } from "@/components/OpportunityCard";
import { button, card, input, label } from "@/components/ui";
import { getInterests, listFeedbackIds, listLiveOpportunities, listStudentOpportunities, matchAll, requireStudent, type Matched } from "@/lib/data";
import { compareMatches, isApplySoon, TYPE_LABELS } from "@/lib/matching/engine";
import { APPLY_SOON_DAYS } from "@/lib/config";
import type { MatchStatus } from "@/lib/matching/types";
import { daysBetween, todayET } from "@/lib/dates";

const BEST_COUNT = 6;
const RECENT_DAYS = 14;

export const metadata: Metadata = { title: "Your opportunities" };

const STATUS_FILTERS: [string, string][] = [
  ["", "Any"],
  ["strong_match", "Strong Match"],
  ["eligible", "Eligible"],
  ["check_requirement", "Check Requirement"],
  ["not_eligible", "Not Eligible"],
];

function one(v: string | string[] | undefined): string {
  return typeof v === "string" ? v : "";
}

export default async function Dashboard({ searchParams }: PageProps<"/dashboard">) {
  const sp = await searchParams;
  const { profile } = await requireStudent();
  const [opps, interests, mine, feedbackIds] = await Promise.all([listLiveOpportunities(), getInterests(), listStudentOpportunities(), listFeedbackIds()]);
  const showHidden = one(sp.hidden) === "1";
  const savedIds = new Set(mine.filter((m) => m.saved_at).map((m) => m.opportunity_id));
  const everything = matchAll(profile, opps, interests);
  // "Not a good match?" answers hide a card from the lists (reversible); ?hidden=1 shows only those.
  const hiddenCount = everything.filter((x) => feedbackIds.has(x.opportunity.id) && x.match.status !== "not_eligible").length;
  const all = everything.filter((x) => feedbackIds.has(x.opportunity.id) === showHidden);

  const f = {
    type: one(sp.type),
    interest: one(sp.interest),
    pay: one(sp.pay),
    mode: one(sp.mode),
    deadline: one(sp.deadline),
    status: one(sp.status),
  };
  const filtering = showHidden || Object.values(f).some(Boolean);

  const eligibleish = all.filter((m) => m.match.status !== "not_eligible");

  const filtered = all.filter(({ opportunity: o, match: m }) => {
    if (f.status ? m.status !== (f.status as MatchStatus) : m.status === "not_eligible") return false;
    if (f.type && o.type !== f.type) return false;
    if (f.interest && !o.interests.includes(f.interest)) return false;
    if (f.pay === "paid" && o.isPaid !== true) return false;
    if (f.mode === "remote" && o.workMode !== "remote" && o.workMode !== "hybrid") return false;
    if (f.mode === "in_person" && o.workMode !== "in_person" && o.workMode !== "hybrid") return false;
    if (f.deadline) {
      const n = Number(f.deadline);
      if (m.deadlineState === "none" || m.daysUntilDeadline === null || m.daysUntilDeadline > n || m.daysUntilDeadline < 0) return false;
    }
    return true;
  });

  const applySoon = eligibleish.filter((x) => isApplySoon(x.match, APPLY_SOON_DAYS)).sort((a, b) => a.match.daysUntilDeadline! - b.match.daysUntilDeadline!);
  const rest = eligibleish.filter((x) => !applySoon.includes(x)).sort(compareMatches);
  const best = rest.slice(0, BEST_COUNT);
  const afterBest = rest.slice(BEST_COUNT);
  const today = todayET();
  const recent = afterBest
    .filter((x) => daysBetween(x.opportunity.createdAt.slice(0, 10), today) <= RECENT_DAYS)
    .sort((a, b) => b.opportunity.createdAt.localeCompare(a.opportunity.createdAt))
    .slice(0, 4);
  const more = afterBest.filter((x) => !recent.includes(x));

  const render = (list: Matched[]) => (
    <ul className="grid gap-4 lg:grid-cols-2">
      {list.map((x) => (
        <li key={x.opportunity.id}>
          <OpportunityCard opportunity={x.opportunity} match={x.match} saved={savedIds.has(x.opportunity.id)} feedback={{ hidden: showHidden }} />
        </li>
      ))}
    </ul>
  );

  const strongCount = eligibleish.filter((x) => x.match.status === "strong_match").length;
  const checkCount = eligibleish.filter((x) => x.match.status === "check_requirement").length;
  const usedTypes = [...new Set(opps.map((o) => o.type))];

  return (
    <>
      <Header active="dashboard" />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-5 pb-20 pt-8">
        {sp.welcome && (
          <p role="status" className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            You&apos;re all set, {profile.first_name}. Here&apos;s what you&apos;re eligible for right now. You can update your profile any time.
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your Opportunities</h1>
        <p className="mt-2 text-muted">
          {eligibleish.length === 0
            ? "Nothing matches yet."
            : `${eligibleish.length} open ${eligibleish.length === 1 ? "opportunity" : "opportunities"} you can apply for — ${strongCount} strong ${strongCount === 1 ? "match" : "matches"}${checkCount ? `, ${checkCount} need a requirement check` : ""}.`}
        </p>

        <form method="get" className={`${card} mt-6 p-4`} aria-label="Filter opportunities">
          {showHidden && <input type="hidden" name="hidden" value="1" />}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
            <Select name="type" label="Type" value={f.type} options={[["", "All types"], ...usedTypes.map((t): [string, string] => [t, TYPE_LABELS[t]])]} />
            <Select name="interest" label="Interest" value={f.interest} options={[["", "All interests"], ...interests.map((i): [string, string] => [i.slug, i.label])]} />
            <Select name="pay" label="Pay" value={f.pay} options={[["", "Any"], ["paid", "Paid only"]]} />
            <Select name="mode" label="Where" value={f.mode} options={[["", "Any"], ["remote", "Remote"], ["in_person", "In person"]]} />
            <Select name="deadline" label="Deadline" value={f.deadline} options={[["", "Any"], ["7", "Within 7 days"], ["14", "Within 14 days"], ["30", "Within 30 days"]]} />
            <Select name="status" label="Match" value={f.status} options={STATUS_FILTERS} />
          </div>
          <div className="mt-3 flex gap-2">
            <button className={button("primary")}>Apply filters</button>
            {filtering && <Link href="/dashboard" className={button("ghost")}>Clear</Link>}
          </div>
        </form>

        {showHidden ? (
          <p className="mt-4 text-sm"><strong>Hidden by you.</strong> These are opportunities you marked “Not a good match”. <Link href="/dashboard" className="underline underline-offset-4">Back to your list</Link></p>
        ) : hiddenCount > 0 ? (
          <p className="mt-4 text-sm text-muted">{hiddenCount} hidden because you marked {hiddenCount === 1 ? "it" : "them"} “Not a good match”. <Link href="/dashboard?hidden=1" className="underline underline-offset-4">Review</Link></p>
        ) : null}

        <div className="mt-10 space-y-12">
          {opps.length === 0 ? (
            <Empty title="No opportunities have been added yet" body="We're adding verified opportunities now. Check back soon." />
          ) : filtering ? (
            <section aria-labelledby="results">
              <h2 id="results" className="mb-4 text-xl font-semibold">{filtered.length} {filtered.length === 1 ? "result" : "results"}</h2>
              {filtered.length ? render([...filtered].sort(compareMatches)) : <Empty title="Nothing matches those filters" body="Try removing a filter." action={<Link href="/dashboard" className={button("secondary")}>Clear filters</Link>} />}
            </section>
          ) : eligibleish.length === 0 ? (
            <Empty title="No current matches" body="Nothing in our verified list fits your profile right now. New opportunities are added regularly — check back, or update your profile." action={<Link href="/profile" className={button("secondary")}>Review my profile</Link>} />
          ) : (
            <>
              {applySoon.length > 0 && (
                <section aria-labelledby="soon">
                  <h2 id="soon" className="mb-1 text-xl font-semibold">Apply Soon</h2>
                  <p className="mb-4 text-sm text-muted">Deadlines in the next {APPLY_SOON_DAYS} days.</p>
                  {render(applySoon)}
                </section>
              )}
              {best.length > 0 && (
                <section aria-labelledby="best">
                  <h2 id="best" className="mb-4 text-xl font-semibold">Best Matches</h2>
                  {render(best)}
                </section>
              )}
              {recent.length > 0 && (
                <section aria-labelledby="recent">
                  <h2 id="recent" className="mb-4 text-xl font-semibold">Recently Added</h2>
                  {render(recent)}
                </section>
              )}
              {more.length > 0 && (
                <section aria-labelledby="more">
                  <h2 id="more" className="mb-4 text-xl font-semibold">More opportunities</h2>
                  {render(more)}
                </section>
              )}
            </>
          )}
        </div>
      </main>
    </>
  );
}

function Select({ name, label: text, value, options }: { name: string; label: string; value: string; options: [string, string][] }) {
  return (
    <div>
      <label htmlFor={`f-${name}`} className={label + " !mb-1 !text-xs text-muted"}>{text}</label>
      <select id={`f-${name}`} name={name} defaultValue={value} className={input + " !py-1.5 text-sm"}>
        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
      </select>
    </div>
  );
}

function Empty({ title, body, action }: { title: string; body: string; action?: React.ReactNode }) {
  return (
    <div className={`${card} p-8 text-center`}>
      <h2 className="text-lg font-semibold">{title}</h2>
      <p className="mx-auto mt-2 max-w-md text-muted">{body}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}
