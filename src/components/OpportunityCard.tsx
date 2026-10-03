import Link from "next/link";
import { formatDate } from "@/lib/dates";
import { selectKeyReasons, TYPE_LABELS } from "@/lib/matching/engine";
import type { MatchResult, Opportunity } from "@/lib/matching/types";
import { formatLocation, formatPay } from "@/lib/opportunities";
import { MatchBadge } from "./MatchBadge";
import { ReasonList } from "./ReasonList";
import { SaveButton } from "./SaveButton";
import { FeedbackControl } from "./FeedbackControl";
import { button, card } from "./ui";

export function deadlineText(o: Opportunity, m: MatchResult): { text: string; urgent: boolean } {
  if (!o.applicationDeadline) return { text: "No deadline listed", urgent: false };
  const d = formatDate(o.applicationDeadline, { year: false });
  if (m.deadlineState === "passed") return { text: `Closed ${d}`, urgent: false };
  const days = m.daysUntilDeadline ?? 0;
  const rel = days === 0 ? "today" : days === 1 ? "tomorrow" : `in ${days} days`;
  return { text: `Due ${d} (${rel})`, urgent: days <= 7 };
}

export function OpportunityCard({
  opportunity: o,
  match: m,
  saved,
  extra,
  feedback,
}: {
  opportunity: Opportunity;
  match: MatchResult;
  saved: boolean;
  extra?: React.ReactNode;
  /** Dashboard only: offer "Not a good match?" (hidden=true when already marked). */
  feedback?: { hidden: boolean };
}) {
  const dl = deadlineText(o, m);
  const canApply = !!o.applicationUrl && m.deadlineState !== "passed";
  return (
    <article className={`${card} fade-in p-5 sm:p-6`}>
      <div className="flex flex-wrap items-center gap-2">
        <MatchBadge status={m.status} />
        <span className="rounded-full bg-black/5 px-2.5 py-1 text-xs font-medium">{TYPE_LABELS[o.type]}</span>
        {o.isSample && <span className="rounded-full border border-dashed border-amber-500 px-2.5 py-1 text-xs font-medium text-amber-900">Sample data</span>}
        {m.stale && <span className="rounded-full border border-line px-2.5 py-1 text-xs text-muted">Needs recheck</span>}
      </div>
      <h3 className="mt-3 text-lg font-semibold leading-snug">
        <Link href={`/opportunities/${o.id}`} className="hover:underline underline-offset-4">{o.title}</Link>
      </h3>
      <p className="text-sm text-muted">{o.organization}</p>

      <dl className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
        <div><dt className="sr-only">Location</dt><dd>{formatLocation(o)}</dd></div>
        <div><dt className="sr-only">Pay</dt><dd>{formatPay(o)}</dd></div>
        <div><dt className="sr-only">Deadline</dt><dd className={dl.urgent ? "font-semibold text-red-800" : ""}>{dl.text}</dd></div>
      </dl>

      <ReasonList reasons={selectKeyReasons(m)} className="mt-4" />
      {extra}

      <div className="mt-5 flex flex-wrap items-center gap-2.5">
        <Link href={`/opportunities/${o.id}`} className={button("primary")}>View details</Link>
        <SaveButton opportunityId={o.id} saved={saved} compact />
        {canApply && (
          <a href={`/go/${o.id}`} target="_blank" rel="noopener noreferrer" className={button("secondary")}>
            Apply<span className="sr-only"> on the official site (opens in a new tab)</span> <span aria-hidden>↗</span>
          </a>
        )}
      </div>
      {feedback && <FeedbackControl opportunityId={o.id} hidden={feedback.hidden} />}
    </article>
  );
}
