"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/data";

export async function recordSourceCheck(formData: FormData): Promise<void> {
  await requireAdmin();
  const sourceId = String(formData.get("source_id") ?? "");
  const outcome = String(formData.get("outcome") ?? "");
  const notes = String(formData.get("notes") ?? "").trim().slice(0, 2000);
  const httpStatusInput = String(formData.get("http_status") ?? "").trim();
  const httpStatus = httpStatusInput ? Number(httpStatusInput) : null;
  if (!/^[a-z0-9][a-z0-9-]{1,79}$/.test(sourceId)) throw new Error("Invalid source ID.");
  if (!["unchanged", "changed", "unavailable", "next_cycle_not_posted"].includes(outcome)) throw new Error("Invalid check outcome.");
  if (httpStatus !== null && (!Number.isInteger(httpStatus) || httpStatus < 100 || httpStatus > 599)) throw new Error("Invalid HTTP status.");

  const supabase = await createClient();
  const { error } = await supabase.rpc("record_opportunity_source_check", {
    p_source_id: sourceId,
    p_outcome: outcome,
    p_http_status: httpStatus,
    p_notes: notes,
  });
  if (error) throw new Error(error.message);

  revalidatePath("/admin/sources");
  revalidatePath("/admin");
  revalidatePath("/browse");
}
