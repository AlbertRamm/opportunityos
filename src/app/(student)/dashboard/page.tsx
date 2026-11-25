import type { Metadata } from "next";
import Link from "next/link";
import { Header } from "@/components/Header";
import { OpportunityCard } from "@/components/OpportunityCard";
import { button, card, input, label } from "@/components/ui";
import { getInterests, listFeedbackIds, listLiveOpportunities, listStudentOpportunities, matchAll, requireStudent, type Matched } from "@/lib/data";
import { compareMatches, isApplySoon, TYPE_LABELS } from "@/lib/matching/engine";
import { APPLY_SOON_DAYS } from "@/lib/config";
import type { MatchStatus } from "@/lib/matching/types";
import { ageOn, todayET } from "@/lib/dates";
import { hasMatchDetails } from "@/lib/match-details";


export const metadata: Metadata = { title: "Your opportunities" };

const STATUS_FILTERS: [string, string][] = [
  ["", "Profile results"],
  ["strong_match", "Strong Match"],
  ["likely_match", "Likely Match"],
  ["eligible", "Eligible"],
  ["check_requirement", "Needs confirmation"],
  ["not_eligible", "Not Eligible"],
];

const MATCH_GROUPS = [
  { status: "strong_match", title: "Strong Match", description: "Meets the listed requirements and fits your interests and preferences." },
  { status: "likely_match", title: "Likely Match", description: "Looks like a fit. Confirm the remaining conditions with the program." },
  { status: "eligible", title: "Eligible", description: "Meets the listed requirements. Explore these if you’re open to other interests or preferences." },
] as const;

function fitsPreferences({ match }: Matched) {
  return match.interestOverlap.length > 0 &&
    match.preferenceConflicts === 0 &&
    !match.matchReasons.preferences.some(({ code }) => code === "type_other");
}

function needsConfirmation(item: Matched) {
  return item.match.status === "check_requirement" ||
    (item.match.status === "likely_match" && !fitsPreferences(item));
}

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

  const filtered = all.filter((item) => {
    const { opportunity: o, match: m } = item;
    if (f.status === "check_requirement") {
      if (!needsConfirmation(item)) return false;
    } else if (f.status ? m.status !== (f.status as MatchStatus) || needsConfirmation(item) : m.status === "not_eligible") {
      return false;
    }
    if (f.type && o.type !== f.type) return false;
    if (f.interest && !o.interests.includes(f.interest)) return false;
    if (f.pay === "paid" && o.isPaid !== true) return false;
    if (f.mode === "remote" && o.workMode !== "remote" && o.workMode !== "hybrid") return false;
    if (f.mode === "in_person" && o.workMode !== "in_person" && o.workMode !== "hybrid") return false;
    if (f.deadline) {
      const n = Number(f.deadline);
      if (!isApplySoon(m, n) || m.status === "check_requirement" || !fitsPreferences(item) || (profile.pay_preference === "paid_only" && o.isPaid !== true)) return false;
    }
    return true;
  });

  const ranked = filtered.sort(compareMatches);
  const confirmed = ranked.filter((item) => !needsConfirmation(item));
  const pending = ranked.filter(needsConfirmation);

  const render = (list: Matched[]) => (
    <ul className="grid gap-4 lg:grid-cols-2">
      {list.map((x) => (
        <li key={x.opportunity.id}>
          <OpportunityCard opportunity={x.opportunity} match={x.match} saved={savedIds.has(x.opportunity.id)} feedback={{ hidden: showHidden }} needsConfirmation={needsConfirmation(x)} />
        </li>
      ))}
    </ul>
  );

  const usedTypes = [...new Set(opps.map((o) => o.type))];
  const interestNames = new Map(interests.map(({ slug, label }) => [slug, label]));
  const availability = [
    profile.available_summer && "Summer",
    profile.available_school_year && "School year",
  ].filter(Boolean).join(" and ");
  const profileFilters = [
    `Grade ${profile.grade} · Age ${ageOn(profile.birth_date, todayET())} · ${profile.state}`,
    availability || "Availability not set",
    profile.interests.map((slug) => interestNames.get(slug) ?? slug.replaceAll("_", " ")).join(", ") || "Any interest",
    profile.opportunity_types.map((type) => TYPE_LABELS[type]).join(", ") || "All opportunity types",
    { paid_only: "Paid only preferred", prefer_paid: "Prefer paid", either: "Any pay" }[profile.pay_preference],
    { remote: "Prefer remote", in_person: "Prefer in person", either: "Any format" }[profile.work_mode_preference],
    profile.work_mode_preference !== "remote" && profile.max_travel_miles < 50 ? `Within ${profile.max_travel_miles} mi preferred` : null,
  ];

  return (
    <>
      <Header active="dashboard" />
      <main id="main" className="mx-auto w-full max-w-5xl flex-1 px-5 pb-20 pt-8">
        {sp.welcome && (
          <p role="status" className="mb-6 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">
            You&apos;re all set, {profile.first_name}. Here are your results, ranked by fit.
          </p>
        )}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">Your matches</h1>
        <section aria-labelledby="profile-filters" className="mt-4 rounded-2xl border border-line bg-accent-soft p-4">
          <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
            <h2 id="profile-filters" className="font-semibold">Matching with your profile</h2>
            <Link href="/profile" className="text-sm font-semibold underline underline-offset-4">Edit my profile</Link>
          </div>
          <ul className="mt-3 flex flex-wrap gap-2">
            {profileFilters.filter(Boolean).map((value, index) => <li key={index} className="rounded-full border border-line bg-white px-3 py-1 text-sm">{value}</li>)}
          </ul>
        </section>

        <details open={filtering} className="mt-4">
          <summary className="w-fit cursor-pointer text-sm font-semibold underline-offset-4 hover:underline">Filter these results{filtering ? ` (${ranked.length})` : ""}</summary>
          <form method="get" className={`${card} mt-3 p-4`} aria-label="Filter opportunities">
            {showHidden && <input type="hidden" name="hidden" value="1" />}
            <div className="grid grid-cols-2 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <Select name="type" label="Type" value={f.type} options={[["", "All types"], ...usedTypes.map((t): [string, string] => [t, TYPE_LABELS[t]])]} />
              <Select name="interest" label="Interest" value={f.interest} options={[["", "All interests"], ...interests.map((i): [string, string] => [i.slug, i.label])]} />
              <Select name="pay" label="Pay" value={f.pay} options={[["", "Any"], ["paid", "Paid only"]]} />
              <Select name="mode" label="Where" value={f.mode} options={[["", "Any"], ["remote", "Remote"], ["in_person", "In person"]]} />
              <Select name="deadline" label="Deadline" value={f.deadline} options={[["", "Any"], ["7", "Fits me · Within 7 days"], [String(APPLY_SOON_DAYS), `Fits me · Within ${APPLY_SOON_DAYS} days`], ["30", "Fits me · Within 30 days"]]} />
              <Select name="status" label="Match" value={f.status} options={STATUS_FILTERS} />
            </div>
            <div className="mt-3 flex gap-2">
              <button className={button("primary")}>Apply filters</button>
              {filtering && <Link href="/dashboard" className={button("ghost")}>Clear</Link>}
            </div>
          </form>
        </details>

        {showHidden ? (
          <p className="mt-4 text-sm"><strong>Hidden by you.</strong> These are opportunities you marked “Not a good match”. <Link href="/dashboard" className="underline underline-offset-4">Back to your list</Link></p>
        ) : hiddenCount > 0 ? (
          <p className="mt-4 text-sm text-muted">{hiddenCount} hidden because you marked {hiddenCount === 1 ? "it" : "them"} “Not a good match”. <Link href="/dashboard?hidden=1" className="underline underline-offset-4">Review</Link></p>
        ) : null}

        <div className="mt-10 space-y-12">
          {opps.length === 0 ? (
            <Empty title="No opportunities have been added yet" body="We're adding verified opportunities now. Check back soon." />
          ) : ranked.length === 0 ? (
            filtering
              ? <Empty title="Nothing matches those filters" body="Try removing a filter." action={<Link href="/dashboard" className={button("secondary")}>Clear filters</Link>} />
              : <Empty title="No current matches" body="Check back for more opportunities or update your profile." action={<Link href="/profile" className={button("secondary")}>Review my profile</Link>} />
          ) : f.status === "not_eligible" ? (
            <section aria-labelledby="ineligible">
              <h2 id="ineligible" className="mb-4 text-xl font-semibold">Not eligible</h2>
              {render(ranked)}
            </section>
          ) : (
            <>
              {MATCH_GROUPS.map(({ status, title, description }) => {
                const group = confirmed.filter(({ match }) => match.status === status);
                if (!group.length) return null;
                return <section key={status} aria-labelledby={status}>
                  <h2 id={status} className="text-xl font-semibold">{title} <span className="ml-1 text-sm font-normal text-muted">({group.length})</span></h2>
                  <p className="mb-4 mt-1 text-sm text-muted">{description}</p>
                  {render(group)}
                </section>;
              })}
              {!confirmed.length && f.status !== "check_requirement" && (
                <p className="text-sm text-muted">We haven’t found a match we can recommend for these settings yet.</p>
              )}
              {pending.length > 0 && (
                <details open={f.status === "check_requirement"} className={`${card} p-4 sm:p-5`}>
                  <summary className="cursor-pointer text-lg font-semibold">Needs confirmation ({pending.length})</summary>
                  <p className="mb-4 mt-2 text-sm text-muted">
                    These listings have requirements you may need to confirm, such as the program’s grade range or residency rules.
                    {!hasMatchDetails(profile) && <> <Link href="/profile#match-details" className="underline underline-offset-4">Add optional match details</Link> to help us check requirements like GPA.</>}
                  </p>
                  {render(pending)}
                </details>
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
