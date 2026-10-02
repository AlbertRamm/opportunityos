import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { OpportunityForm } from "@/components/OpportunityForm";
import { button, card } from "@/components/ui";
import { getInterests } from "@/lib/data";
import { createClient } from "@/lib/supabase/server";
import { rowToOpportunity, type OpportunityRow } from "@/lib/opportunities";
import { opportunityToFormValues } from "@/lib/opportunity-form";
import { markReverified, setArchived } from "../../actions";
import { REVERIFY_AFTER_DAYS } from "@/lib/config";
import { daysBetween, formatDate, todayET } from "@/lib/dates";

export const metadata: Metadata = { title: "Admin · Edit opportunity" };

export default async function EditOpportunity({ params, searchParams }: PageProps<"/admin/opportunities/[id]">) {
  const { id } = await params;
  const sp = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const supabase = await createClient();
  const { data } = await supabase.from("opportunities").select("*").eq("id", id).maybeSingle();
  if (!data) notFound();
  const opp = rowToOpportunity(data as OpportunityRow);
  const interests = await getInterests();
  const age = opp.lastVerifiedAt ? daysBetween(opp.lastVerifiedAt.slice(0, 10), todayET()) : null;
  const verified = opp.verificationStatus === "verified";

  return (
    <>
      {sp.saved && <p role="status" className="mb-4 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-900">{sp.saved === "verified" ? "Saved and verified." : "Saved."}</p>}
      <h1 className="text-3xl font-semibold tracking-tight">{opp.title}</h1>
      <div className={`${card} mt-4 mb-8 flex flex-wrap items-center gap-x-6 gap-y-3 p-4 text-sm`}>
        <span><strong>Status:</strong> {opp.archivedAt ? "Archived" : verified ? "Verified (visible to students)" : "Unverified (hidden from students)"}</span>
        <span><strong>Last verified:</strong> {opp.lastVerifiedAt ? `${formatDate(opp.lastVerifiedAt.slice(0, 10))} (${age} days ago${age! > REVERIFY_AFTER_DAYS ? " — STALE" : ""})` : "never"}</span>
        <span className="flex flex-wrap gap-2 sm:ml-auto">
          {verified && (
            <form action={markReverified.bind(null, opp.id)}><button className={button("secondary")}>Re-checked: nothing changed</button></form>
          )}
          <form action={setArchived.bind(null, opp.id, !opp.archivedAt)}>
            <button className={button(opp.archivedAt ? "secondary" : "danger")}>{opp.archivedAt ? "Restore" : "Archive"}</button>
          </form>
        </span>
      </div>
      {opp.isSample && <p className="mb-6 rounded-lg border border-dashed border-amber-500 bg-amber-50 px-4 py-3 text-sm">This is <strong>sample data</strong>. Archive or delete it before launch (see README).</p>}
      <OpportunityForm initial={opportunityToFormValues(opp)} interests={interests} id={opp.id} verified={verified} />
    </>
  );
}
