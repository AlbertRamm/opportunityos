"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";

export async function recordSourceCheck(formData: FormData): Promise<void> {
  const admin = await requireAdmin();
  const sourceId = String(formData.get("source_id") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000);
  const httpStatusInput = String(formData.get("http_status") ?? "").trim();
  const httpStatus = httpStatusInput ? Number(httpStatusInput) : null;
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(sourceId)) throw new Error("Invalid source ID.");
  if (!["unchanged", "changed", "unavailable", "next_cycle_not_posted"].includes(outcome)) throw new Error("Invalid check outcome.");
  if (httpStatus !== null && (!Number.isInteger(httpStatus) || httpStatus < 100 || httpStatus > 599)) throw new Error("Invalid HTTP status.");

  const supabase = await createClient();
  const { data: source, error: sourceError } = await supabase
    .from("opportunity_sources")
    .select("review_interval_days")
    .eq("id", sourceId)
    .single();
  if (sourceError || !source) throw new Error(sourceError?.message ?? "Source not found.");
  const checkedAt = new Date().toISOString();
  const { error: insertError } = await supabase.from("opportunity_source_checks").insert({
    source_id: sourceId,
    checked_by: admin.id,
    outcome,
    http_status: httpStatus,
    notes,
  });
  if (insertError) throw new Error(insertError.message);

  const cadenceDays = outcome === "unavailable" ? 7 : source.review_interval_days;
  const nextReview = new Date(Date.now() + cadenceDays * 86_400_000).toISOString().slice(0, 10);
  const { error: updateError } = await supabase.from("opportunity_sources").update({
    last_checked_at: checkedAt,
    next_review_at: nextReview,
    last_http_status: httpStatus,
    status: outcome === "unavailable" ? "paused" : "watch",
  }).eq("id", sourceId);
  if (updateError) throw new Error(updateError.message);

  if (["changed", "unavailable", "next_cycle_not_posted"].includes(outcome)) {
    const recheckMarker = new Date(Date.now() - 31 * 86_400_000).toISOString();
    const { error: staleError } = await supabase.from("opportunities")
      .update({ last_verified_at: recheckMarker })
      .eq("source_id", sourceId)
      .eq("verification_status", "verified");
    if (staleError) throw new Error(staleError.message);
  }

  revalidatePath("/admin/sources");
  revalidatePath("/admin");
  revalidatePath("/browse");
}
