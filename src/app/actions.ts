"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { getInterests, getOpportunity, getProfileRow, getUser, matchAll } from "@/lib/data";
import { FEEDBACK_VALUES } from "@/lib/feedback";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/status";
import { trackEvent, trackEventOnce, type EventName } from "@/lib/analytics";
import { todayET } from "@/lib/dates";

/** Fire-and-forget events from client components. Allow-listed; never trusts arbitrary names. */
export async function trackClientEvent(
  name: Extract<EventName, "landing_page_view" | "opportunity_viewed" | "onboarding_started">,
  opportunityId?: string,
): Promise<void> {
  if (name === "landing_page_view") return trackEvent(name);
  if (name === "onboarding_started") return trackEventOnce(name);
  if (name === "opportunity_viewed" && opportunityId && (await getOpportunity(opportunityId))) {
    return trackEvent(name, { opportunityId });
  }
}

/** Once per browser session: records a `return_session` if the student last visited on an earlier day. */
export async function pingSession(): Promise<void> {
  const user = await getUser();
  const profile = await getProfileRow();
  if (!user || !profile?.onboarding_completed_at) return;
  const supabase = await createClient();
  const { data } = await supabase.from("profiles").select("last_seen_at").eq("user_id", user.id).maybeSingle();
  const last = (data as { last_seen_at: string | null } | null)?.last_seen_at ?? null;
  const today = todayET();
  if (last && todayET(new Date(last)) === today) return;
  await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("user_id", user.id);
  if (last) await trackEvent("return_session");
}

export async function toggleSave(opportunityId: string, save: boolean): Promise<{ ok: boolean }> {
  const user = await getUser();
  if (!user) return { ok: false };
  if (!(await getOpportunity(opportunityId))) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase
    .from("student_opportunities")
    .upsert(
      { user_id: user.id, opportunity_id: opportunityId, saved_at: save ? new Date().toISOString() : null },
      { onConflict: "user_id,opportunity_id" },
    );
  if (error) {
    console.error("[save] failed", error.message);
    return { ok: false };
  }
  await trackEvent(save ? "opportunity_saved" : "opportunity_unsaved", { opportunityId });
  revalidatePath("/saved");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Student self-report only. Passing null clears it. */
export async function setApplicationStatus(opportunityId: string, status: ApplicationStatus | null): Promise<{ ok: boolean }> {
  const user = await getUser();
  if (!user) return { ok: false };
  if (status !== null && !(status in STATUS_LABELS)) return { ok: false };
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("student_opportunities")
    .update({ status, status_updated_at: new Date().toISOString() })
    .eq("user_id", user.id)
    .eq("opportunity_id", opportunityId)
    .not("saved_at", "is", null)
    .select("opportunity_id");
  if (error || !data?.length) return { ok: false };
  await trackEvent("opportunity_status_changed", { opportunityId, properties: { status: status ?? "cleared" } });
  revalidatePath("/saved");
  return { ok: true };
}

/** "Not a good match?" — one answer per student per opportunity (re-submitting replaces it). No free text. */
export async function submitFeedback(opportunityId: string, reason: string): Promise<{ ok: boolean }> {
  const user = await getUser();
  if (!user || !FEEDBACK_VALUES.includes(reason)) return { ok: false };
  const [opp, profile, interests] = await Promise.all([getOpportunity(opportunityId), getProfileRow(), getInterests()]);
  if (!opp || !profile) return { ok: false };
  // The match status is recomputed here from the same deterministic engine — never trusted from the client.
  const [{ match }] = matchAll(profile, [opp], interests);
  const supabase = await createClient();
  const { error } = await supabase
    .from("match_feedback")
    .upsert({ user_id: user.id, opportunity_id: opp.id, reason, match_status: match.status }, { onConflict: "user_id,opportunity_id" });
  if (error) {
    console.error("[feedback] failed", error.message);
    return { ok: false };
  }
  await trackEvent("match_feedback_submitted", { opportunityId: opp.id, properties: { reason, match_status: match.status } });
  return { ok: true };
}

export async function undoFeedback(opportunityId: string): Promise<{ ok: boolean }> {
  const user = await getUser();
  if (!user) return { ok: false };
  const supabase = await createClient();
  const { error } = await supabase.from("match_feedback").delete().eq("user_id", user.id).eq("opportunity_id", opportunityId);
  if (error) return { ok: false };
  // No revalidatePath: the card stays on screen showing "Restored" until the student navigates (dashboard is always dynamic).
  return { ok: true };
}
