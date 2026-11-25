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
  schedule_period: string | null;
  min_grade: number | null;
  max_grade: number | null;
  application_deadline: string | null;
  application_url: string;
  source_url: string;
  last_verified_at: string;
}

/** Public directory data is served from the freshness-gated database view. */
export async function listPublicCatalog(): Promise<PublicCatalogListing[]> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    console.error("[catalog] Supabase public environment is not configured.");
    return [];
  }

  const supabase = createAnonClient();
  const { data, error } = await supabase
    .from("public_opportunities")
    .select("id,title,organization,description,opportunity_type,interests,location_name,work_mode,compensation_description,schedule_period,min_grade,max_grade,application_deadline,application_url,source_url,last_verified_at")
    .order("application_deadline", { ascending: true, nullsFirst: false });

  if (error) {
    console.error("[catalog] Public view is unavailable; check the database migration:", error.message);
    return [];
  }

  return (data ?? []) as PublicCatalogListing[];
}
