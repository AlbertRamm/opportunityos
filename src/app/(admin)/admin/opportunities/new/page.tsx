import type { Metadata } from "next";
import { OpportunityForm } from "@/components/OpportunityForm";
import { getInterests } from "@/lib/data";
import { safeHttpUrl } from "@/lib/opportunities";

export const metadata: Metadata = { title: "Admin · New opportunity" };

export default async function NewOpportunity({ searchParams }: PageProps<"/admin/opportunities/new">) {
  const sp = await searchParams;
  const source = safeHttpUrl(typeof sp.source_url === "string" ? sp.source_url : null);
  const interests = await getInterests();
  return (
    <>
      <h1 className="mb-6 text-3xl font-semibold tracking-tight">New opportunity</h1>
      <OpportunityForm interests={interests} verified={false} initial={source ? { source_url: source, application_url: source } : {}} />
    </>
  );
}
