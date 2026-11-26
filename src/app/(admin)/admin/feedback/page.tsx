import Link from "next/link";
import { requireAdmin } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { FEEDBACK_LABEL } from "@/lib/feedback";
import { MATCH_LABEL } from "@/components/MatchBadge";
import { card, button } from "@/components/ui";
import { markFeedbackReviewed } from "../actions";

export const metadata = { title: "Admin · Student reports" };

interface ReportRow {
  user_id: string;
  opportunity_id: string;
  reason: string;
  match_status: string;
  created_at: string;
}

export default async function StudentReports() {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase.from("match_feedback")
    .select("user_id,opportunity_id,reason,match_status,created_at")
    .in("reason", ["eligibility_wrong", "info_outdated"])
    .is("reviewed_at", null)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) throw new Error(error.message);

  const reports = (data ?? []) as ReportRow[];
  const ids = [...new Set(reports.map((r) => r.opportunity_id))];
  const { data: opportunities, error: opportunitiesError } = ids.length
    ? await supabase.from("opportunities").select("id,title,organization").in("id", ids)
    : { data: [], error: null };
  if (opportunitiesError) throw new Error(opportunitiesError.message);
  const titles = new Map((opportunities ?? []).map((o) => [o.id, `${o.title} · ${o.organization}`]));

  return <>
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><h1 className="text-3xl font-semibold tracking-tight">Student reports</h1><p className="mt-2 text-sm text-muted">Eligibility and outdated-information reports stay separate from “not a fit” feedback.</p></div>
      <Link href="/admin" className={button("secondary")}>Back to opportunities</Link>
    </div>
    {reports.length === 0 ? <p className={`${card} mt-6 p-6 text-sm text-muted`}>No open reports.</p> :
      <ul className="mt-6 space-y-3">{reports.map((report) => <li key={`${report.user_id}:${report.opportunity_id}`} className={`${card} flex flex-wrap items-center justify-between gap-4 p-4`}>
        <div><Link href={`/admin/opportunities/${report.opportunity_id}`} className="font-semibold underline underline-offset-4">{titles.get(report.opportunity_id) ?? "Opportunity unavailable"}</Link>
          <p className="mt-1 text-sm">{FEEDBACK_LABEL[report.reason]} · Match shown: {MATCH_LABEL[report.match_status as keyof typeof MATCH_LABEL] ?? report.match_status}</p>
          <p className="mt-1 text-xs text-muted">Reported {new Date(report.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York" })}</p></div>
        <form action={markFeedbackReviewed.bind(null, report.user_id, report.opportunity_id)}><button className={button("secondary")}>Mark reviewed</button></form>
      </li>)}</ul>}
  </>;
}
