"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getInterests, requireAdmin } from "@/lib/data";
import { str, strOrNull, type FormState } from "@/lib/forms";
import { fillCoordinates } from "@/lib/geo";
import { evidenceCoverageErrors, parseSourceEvidence, validateOpportunityForm } from "@/lib/opportunity-validation";

export type OppFormState = FormState<Record<string, string | string[]>>;

function snapshot(fd: FormData): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {};
  for (const key of new Set(fd.keys())) {
    if (key.startsWith("$ACTION")) continue;
    const all = fd.getAll(key).filter((v): v is string => typeof v === "string");
    out[key] = key === "interests" ? all : (all[0] ?? "");
  }
  return out;
}

export async function saveOpportunity(_prev: OppFormState, fd: FormData): Promise<OppFormState> {
  const admin = await requireAdmin();
  const values = snapshot(fd);
  const id = strOrNull(fd, "id");
  const intent = str(fd, "intent"); // save | verify | unverify
  if (!new Set(["save", "verify", "unverify"]).has(intent)) {
    return { values, error: "Choose whether to save, verify, or unverify this listing." };
  }
  const validInterests = new Set((await getInterests()).map((i) => i.slug));
  const { errors, row } = validateOpportunityForm(fd, validInterests, intent);
  const parsedEvidence = parseSourceEvidence(str(fd, "source_evidence"));
  if (parsedEvidence.error) errors.source_evidence = parsedEvidence.error;
  if (intent === "verify" && !parsedEvidence.error) {
    const missing = evidenceCoverageErrors(row, parsedEvidence.evidence);
    if (missing.length) errors.source_evidence = `Add official-page evidence for: ${missing.join(", ")}.`;
  }
  const verifiedOn = str(fd, "last_verified_on");
  if (intent === "verify" && fd.get("reviewed") !== "on") {
    errors.reviewed = "Tick the box to confirm you compared every field to the source page.";
  }
  if (Object.keys(errors).length > 0) return { values, fieldErrors: errors, error: "Fix the highlighted fields." };

  await fillCoordinates(row);

  const verification = intent === "verify" ? {
    verification_status: "verified",
    last_verified_at: verifiedOn ? `${verifiedOn}T12:00:00Z` : new Date().toISOString(),
    verified_by: admin.id,
  } : null;
  if (intent !== "verify") {
    row.verification_status = "unverified";
  }

  const supabase = await createClient();
  let savedId = id;
  if (id) {
    const { error } = await supabase.from("opportunities").update(row).eq("id", id);
    if (error) return { values, error: dbMessage(error.message) };
  } else {
    const { data, error } = await supabase
      .from("opportunities")
      .insert({ ...row, created_by: admin.id })
      .select("id")
      .single();
    if (error || !data) return { values, error: dbMessage(error?.message) };
    savedId = data.id;
  }
  const { error: evidenceError } = await supabase.from("opportunity_admin").upsert({ opportunity_id: savedId, source_evidence: parsedEvidence.evidence }, { onConflict: "opportunity_id" });
  if (evidenceError) return { values, error: `Opportunity saved as a draft, but evidence was not saved: ${evidenceError.message}` };
  if (verification) {
    const { error } = await supabase.from("opportunities").update(verification).eq("id", savedId);
    if (error) return { values, error: `The listing remains hidden as a draft because verification could not be completed. ${dbMessage(error.message)}` };
  }
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  redirect(`/admin/opportunities/${savedId}?saved=${intent === "verify" ? "verified" : "1"}`);
}

function dbMessage(msg?: string): string {
  if (msg?.includes("verified_has_basics")) return "A verified opportunity needs an application URL, a source URL, and a verification date.";
  console.error("[admin] save failed", msg);
  return "Could not save. " + (msg ?? "");
}

export async function setArchived(id: string, archived: boolean): Promise<void> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("opportunities").update({ archived_at: archived ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath(`/admin/opportunities/${id}`);
}

/** "I re-checked the official page and nothing changed." Sets last_verified_at to now. */
export async function markReverified(id: string): Promise<void> {
  const admin = await requireAdmin();
  const supabase = await createClient();
  const [{ data: opportunity }, { data: adminRecord }] = await Promise.all([
    supabase.from("opportunities").select("*").eq("id", id).maybeSingle(),
    supabase.from("opportunity_admin").select("source_evidence").eq("opportunity_id", id).maybeSingle(),
  ]);
  if (!opportunity) throw new Error("Opportunity not found.");
  const evidence = (adminRecord?.source_evidence ?? {}) as Record<string, { quote: string; url: string }>;
  const missing = evidenceCoverageErrors(opportunity as Record<string, unknown>, evidence);
  if (missing.length) throw new Error(`Add current official-page evidence for ${missing.join(", ")} before re-verifying.`);
  const { error } = await supabase
    .from("opportunities")
    .update({ verification_status: "verified", last_verified_at: new Date().toISOString(), verified_by: admin.id })
    .eq("id", id);
  if (error) throw new Error(dbMessage(error.message));
  revalidatePath("/admin");
  revalidatePath(`/admin/opportunities/${id}`);
}

export async function markFeedbackReviewed(userId: string, opportunityId: string): Promise<void> {
  const admin = await requireAdmin();
  if (!/^[0-9a-f-]{36}$/i.test(userId) || !/^[0-9a-f-]{36}$/i.test(opportunityId)) throw new Error("Invalid report.");
  const supabase = await createClient();
  const { error } = await supabase.from("match_feedback").update({ reviewed_at: new Date().toISOString(), reviewed_by: admin.id })
    .eq("user_id", userId).eq("opportunity_id", opportunityId);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/feedback");
}
