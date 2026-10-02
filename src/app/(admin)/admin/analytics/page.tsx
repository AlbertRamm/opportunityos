import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { card } from "@/components/ui";

export const metadata: Metadata = { title: "Admin · Analytics" };

interface Metrics {
  registered_students: number;
  completed_profiles: number;
  weekly_active_students: number;
  views_total: number;
  views_unique_pairs: number;
  saves_total: number;
  saves_unique_pairs: number;
  clicks_total: number;
  clicks_unique_pairs: number;
  reported_applied_pairs: number;
  reported_interview_pairs: number;
  reported_accepted_pairs: number;
  funnel: Record<"registered" | "completed_profile" | "saved" | "clicked" | "reported_applied" | "reported_interview" | "reported_accepted", number>;
}

const FUNNEL: [keyof Metrics["funnel"], string, string][] = [
  ["registered", "Registered", "Verified an email address"],
  ["completed_profile", "Completed profile", "Finished onboarding"],
  ["saved", "Saved an opportunity", "Ever saved at least one"],
  ["clicked", "Clicked an application link", "Opened an official application page. NOT proof of applying"],
  ["reported_applied", "Reported applied", "Self-reported Applied (or a later stage)"],
  ["reported_interview", "Reported interview", "Self-reported Interview or Accepted"],
  ["reported_accepted", "Reported accepted", "Self-reported Accepted"],
];

export default async function Analytics() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("admin_metrics");
  if (error || !data) throw new Error(`Could not load metrics: ${error?.message ?? "no data"}`);
  const m = data as Metrics;
  const top = Math.max(1, m.funnel.registered);

  return (
    <>
      <h1 className="text-3xl font-semibold tracking-tight">Analytics</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted">
        Admin accounts are excluded. Counts are distinct students unless labeled otherwise. With small numbers, treat every percentage as anecdotal.
      </p>

      <dl className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-3">
        <Tile k="Registered students" v={m.registered_students} note="Verified an email" />
        <Tile k="Completed profiles" v={m.completed_profiles} note={pct(m.completed_profiles, m.registered_students) + " of registered"} />
        <Tile k="Weekly active students" v={m.weekly_active_students} note="Any activity, last 7 days" />
        <Tile k="Opportunities viewed" v={m.views_unique_pairs} note={`${m.views_total} total page views; unique student × opportunity`} />
        <Tile k="Opportunities saved" v={m.saves_unique_pairs} note={`${m.saves_total} save actions; unique student × opportunity`} />
        <Tile k="Application link clicks" v={m.clicks_unique_pairs} note={`${m.clicks_total} total clicks; unique student × opportunity. Not applications.`} />
        <Tile k="Student-reported applications" v={m.reported_applied_pairs} note="Self-reported Applied or later (student × opportunity)" />
        <Tile k="Reported interviews" v={m.reported_interview_pairs} note="Self-reported Interview or Accepted" />
        <Tile k="Reported acceptances" v={m.reported_accepted_pairs} note="Self-reported Accepted" />
      </dl>

      <section aria-labelledby="funnel" className={`${card} mt-10 p-6`}>
        <h2 id="funnel" className="text-xl font-semibold">Funnel (distinct students)</h2>
        <p className="mt-1 text-sm text-muted">Stages aren&apos;t strictly nested: a student can report “Applied” without us seeing a click.</p>
        <ol className="mt-6 space-y-4">
          {FUNNEL.map(([key, name, def]) => {
            const n = m.funnel[key];
            return (
              <li key={key}>
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <span className="font-medium">{name}</span>
                  <span className="tabular-nums"><strong>{n}</strong> <span className="text-sm text-muted">({pct(n, top)} of registered)</span></span>
                </div>
                <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-black/5" aria-hidden>
                  <div className="h-full rounded-full bg-accent" style={{ width: `${Math.min(100, (n / top) * 100)}%` }} />
                </div>
                <p className="mt-1 text-xs text-muted">{def}</p>
              </li>
            );
          })}
        </ol>
      </section>
    </>
  );
}

function pct(n: number, d: number): string {
  return d === 0 ? "—" : `${Math.round((n / d) * 100)}%`;
}

function Tile({ k, v, note }: { k: string; v: number; note: string }) {
  return (
    <div className={`${card} p-5`}>
      <dt className="text-sm text-muted">{k}</dt>
      <dd className="mt-1 text-4xl font-semibold tabular-nums tracking-tight">{v}</dd>
      <p className="mt-1 text-xs text-muted">{note}</p>
    </div>
  );
}
