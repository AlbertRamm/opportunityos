import "server-only";
import { createAnonClient } from "@/lib/supabase/anon";

export interface PublicCatalogListing {
  id: string;
  title: string;
  organization: string;
  description: string;
  opportunity_type: string;
  interests: string[];
  location_name: string | null;
  work_mode: string | null;
  compensation_description: string | null;
  cost_status: string;
  cost_min: number | string | null;
  cost_max: number | string | null;
  cost_description: string | null;
  allowed_schools: string[];
  schedule_period: string | null;
  min_grade: number | null;
  max_grade: number | null;
  application_deadline: string | null;
  application_url: string;
  source_url: string;
  last_verified_at: string;
}

export function formatPublicCost(listing: PublicCatalogListing): string {
  if (listing.cost_status === "free") return "Free";
  if (listing.cost_status === "not_applicable") return "Cost not applicable";
  const minimum = listing.cost_min === null ? null : Number(listing.cost_min);
  const maximum = listing.cost_max === null ? null : Number(listing.cost_max);
  if (minimum !== null && maximum !== null && minimum !== maximum) return `$${minimum.toLocaleString()}–$${maximum.toLocaleString()}${listing.cost_description ? ` · ${listing.cost_description}` : ""}`;
  if (minimum !== null) return `$${minimum.toLocaleString()}${listing.cost_description ? ` · ${listing.cost_description}` : ""}`;
  return listing.cost_description || (listing.cost_status === "has_fee" ? "Fee applies" : "Cost not listed");
}

function publicCatalogQuery() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Opportunity catalog configuration is missing.");
  }

  const supabase = createAnonClient();
  return supabase
    .from("public_opportunities")
    .select("id,title,organization,description,opportunity_type,interests,location_name,work_mode,compensation_description,cost_status,cost_min,cost_max,cost_description,allowed_schools,schedule_period,min_grade,max_grade,application_deadline,application_url,source_url,last_verified_at");
}

function assertCatalogAvailable(error: { message: string } | null) {
  if (error) {
    console.error("[catalog] Public view is unavailable; check the database migration:", error.message);
    throw new Error("Opportunity catalog is unavailable.");
  }

}

/** Public directory data is served from the freshness-gated database view. */
export async function listPublicCatalog(): Promise<PublicCatalogListing[]> {
  const { data, error } = await publicCatalogQuery()
    .order("application_deadline", { ascending: true, nullsFirst: false });
  assertCatalogAvailable(error);
  return (data ?? []) as PublicCatalogListing[];
}

export async function getPublicListing(id: string): Promise<PublicCatalogListing | null> {
  const { data, error } = await publicCatalogQuery().eq("id", id).maybeSingle();
  assertCatalogAvailable(error);
  return data as PublicCatalogListing | null;
}

