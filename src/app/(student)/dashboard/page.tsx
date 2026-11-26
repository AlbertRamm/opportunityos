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
  ["closed", "Closed"],
];

const MATCH_GROUPS = [
  { status: "strong_match", title: "Strong Match", description: "Meets the listed requirements and fits your interests and preferences." },
  { status: "likely_match", title: "Likely Match", description: "Looks like a fit. Confirm the remaining conditions with the program." },
  { status: "eligible", title: "Eligible", description: "Meets the listed requirements. Explore these if you’re open to other interests or preferences." },
] as const;

function fitsPreferences({ match }: Matched) {
  return match.interestOverlap.length > 0 &&
    match.preferenceConflicts === 0 &&
    match.preferenceUncertainties === 0 &&
    !match.matchReasons.preferences.some(({ code }) => code === "type_other");
}

function needsConfirmation({ match }: Matched) {
  return match.status === "check_requirement";
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
  const hiddenCount = everything.filter((x) => feedbackIds.has(x.opportunity.id) && x.match.status !== "not_eligible" && x.match.status !== "closed").length;
  const all = everything.filter((x) => feedbackIds.has(x.opportunity.id) === showHidden);

  const f = {
    q: one(sp.q).trim().slice(0, 80),
    type: one(sp.type),
    interest: one(sp.interest),
    pay: one(sp.pay),
    mode: one(sp.mode),
    deadline: one(sp.deadline),
    status: one(sp.status),
  };
  const filtering = showHidden || Object.values(f).some(Boolean);
  const filterLabels: Record<keyof typeof f, string> = {
    q: f.q ? `Search: ${f.q}` : "",
    type: TYPE_LABELS[f.type as keyof typeof TYPE_LABELS] ?? f.type,
    interest: interests.find((interest) => interest.slug === f.interest)?.label ?? f.interest,
    pay: f.pay === "paid" ? "Paid only" : f.pay,
    mode: { remote: "Remote", in_person: "In person" }[f.mode as "remote" | "in_person"] ?? f.mode,
    deadline: f.deadline ? `Deadline within ${f.deadline} days` : "",
    status: STATUS_FILTERS.find(([value]) => value === f.status)?.[1] ?? f.status,
  };
  const selectedFilters = (Object.entries(f) as [keyof typeof f, string][])
    .filter(([key, value]) => Boolean(value) && Boolean(filterLabels[key]))
    .map(([key]) => ({ key, label: filterLabels[key] }));
  const removeFilterHref = (removed: keyof typeof f) => {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(f) as [keyof typeof f, string][]) {
      if (key !== removed && value) params.set(key, value);
    }
    if (showHidden) params.set("hidden", "1");
    const query = params.toString();
    return query ? `/dashboard?${query}` : "/dashboard";
  };

  const filtered = all.filter((item) => {
    const { opportunity: o, match: m } = item;
    if (f.status === "check_requirement") {
      if (!needsConfirmation(item)) return false;
    } else if (f.status ? m.status !== (f.status as MatchStatus) : m.status === "not_eligible" || m.status === "closed") {
      return false;
    }
    if (f.type && o.type !== f.type) return false;
    if (f.q && !`${o.title} ${o.organization} ${o.description}`.toLocaleLowerCase().includes(f.q.toLocaleLowerCase())) return false;
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
  const alternative = (item: Matched) => !f.status && !showHidden &&
    (item.match.status === "likely_match" || needsConfirmation(item)) && !fitsPreferences(item);
  const otherOptions = ranked.filter(alternative);
  const confirmed = ranked.filter((item) => !alternative(item) && !needsConfirmation(item));
  const pending = ranked.filter((item) => !alternative(item) && needsConfirmation(item));

  const render = (list: Matched[]) => (
    <ul className="grid gap-4 lg:grid-cols-2">
      {list.map((x) => (
        <li key={x.opportunity.id}>
          <OpportunityCard opportunity={x.opportunity} match={x.match} saved={savedIds.has(x.opportunity.id)} feedback={{ hidden: showHidden }} needsConfirmation={needsConfirmation(x)} />
        </li>
      ))}
    </ul>
  );
  const renderPreview = (list: Matched[]) => {
    if (filtering || list.length <= 3) return render(list);
    return <>
      {render(list.slice(0, 3))}
      <details className="mt-4">
        <summary className="w-fit cursor-pointer text-sm font-semibold underline-offset-4 hover:underline">
          See all {list.length} results
        </summary>
        {render(list.slice(3))}
      </details>
    </>;
  };

  const usedTypes = [...new Set(opps.map((o) => o.type))];
  const interestNames = new Map(interests.map(({ slug, label }) => [slug, label]));
  const availability = [
    profile.available_summer && "Summer",
    profile.available_school_year && "School year",
  ].filter(Boolean).join(" and ");
  const interestSummary = profile.interests.slice(0, 2)
    .map((slug) => interestNames.get(slug) ?? slug.replaceAll("_", " "))
    .join(", ");
  const additionalInterests = profile.interests.length - 2;
  const profileBasics = [
    `Grade ${profile.grade}`,
    `Age ${ageOn(profile.birth_date, todayET())}`,
    profile.state,
    availability || "Availability not set",
  ];
  const profilePreferences = [
    interestSummary ? `${interestSummary}${additionalInterests > 0 ? ` +${additionalInterests}` : ""}` : "Any interest",
    profile.opportunity_types.map((type) => TYPE_LABELS[type]).join(" and ") || "Any type",
    { paid_only: "Paid only", prefer_paid: "Prefer paid", either: "Any pay" }[profile.pay_preference],
    { remote: "Prefer remote", in_person: "Prefer in person", either: "Any format" }[profile.work_mode_preference],
    profile.work_mode_preference !== "remote" && profile.max_travel_miles < 50 ? `Within ${profile.max_travel_miles} mi preferred` : null,
  ].filter(Boolean);
  const profileFilters = [...profileBasics, ...profilePreferences];

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
              <div className="col-span-2 md:col-span-3 lg:col-span-2">
                <label htmlFor="f-q" className={label + " !mb-1 !text-xs text-muted"}>Search</label>
                <input id="f-q" name="q" type="search" maxLength={80} defaultValue={f.q} placeholder="Title, organization, or details" className={input + " !py-1.5 text-sm"} />
              </div>
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

        {selectedFilters.length > 0 && (
          <section aria-label="Applied filters" className="mt-4">
            <p className="mb-2 text-sm font-semibold">Applied filters</p>
            <ul className="flex flex-wrap gap-2">
              {selectedFilters.map(({ key, label: value }) => (
                <li key={key}>
                  <Link href={removeFilterHref(key)} className="inline-flex items-center gap-2 rounded-full border border-line bg-white px-3 py-1 text-sm hover:bg-accent-soft">
                    {value}<span aria-hidden>×</span><span className="sr-only">Remove filter</span>
                  </Link>
                </li>
              ))}
              <li><Link href={showHidden ? "/dashboard?hidden=1" : "/dashboard"} className="px-2 py-1 text-sm underline underline-offset-4">Clear filters</Link></li>
            </ul>
          </section>
        )}

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
          ) : f.status === "closed" ? (
            <section aria-labelledby="closed"><h2 id="closed" className="text-xl font-semibold">Closed opportunities</h2>{render(ranked)}</section>
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
                  {renderPreview(group)}
                </section>;
              })}
              {!confirmed.length && f.status !== "check_requirement" && (
                <p className="text-sm text-muted">We haven’t found a match we can recommend for these settings yet.</p>
              )}
              {pending.length > 0 && (
                <details open={f.status === "check_requirement"} className={`${card} p-4 sm:p-5`}>
                  <summary className="cursor-pointer text-lg font-semibold">Needs confirmation ({pending.length})</summary>
                  <p className="mb-4 mt-2 text-sm text-muted">
                    These listings have a requirement we couldn’t verify, such as the program’s grade range or residency rules.
                    {!hasMatchDetails(profile) && <> <Link href="/profile#match-details" className="underline underline-offset-4">Add optional match details</Link> to help us check requirements like GPA.</>}
                  </p>
                  {render(pending)}
                </details>
              )}
              {otherOptions.length > 0 && (
                <details className={`${card} p-4 sm:p-5`}>
                  <summary className="cursor-pointer text-lg font-semibold">Outside your preferences ({otherOptions.length})</summary>
                  <p className="my-3 text-sm text-muted">These listings have additional conditions and fall outside your selected interests or preferences.</p>
                  {render(otherOptions)}
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
