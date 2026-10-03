import "server-only";
import { createClient } from "@/lib/supabase/server";

export const EVENT_NAMES = [
  "landing_page_view",
  "onboarding_started",
  "onboarding_completed",
  "opportunity_viewed",
  "opportunity_saved",
  "opportunity_unsaved",
  "application_link_clicked",
  "opportunity_status_changed",
  "return_session",
  "match_feedback_submitted",
] as const;
export type EventName = (typeof EVENT_NAMES)[number];

/**
 * Privacy-conscious: no IPs, no user agents, no free text. Only the event name, the signed-in user
 * (null for the anonymous landing view), an optional opportunity id, and tiny structured properties.
 * Analytics must never break a request, so failures are logged and swallowed.
 */
export async function trackEvent(
  name: EventName,
  opts: { opportunityId?: string; properties?: Record<string, string | number | boolean> } = {},
): Promise<void> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    const userId = data.user?.id ?? null;
    if (!userId && name !== "landing_page_view") return;
    const { error } = await supabase.from("events").insert({
      event_name: name,
      user_id: userId,
      opportunity_id: opts.opportunityId ?? null,
      properties: opts.properties ?? {},
    });
    if (error) console.error("[analytics] insert failed", name, error.message);
  } catch (e) {
    console.error("[analytics] failed", name, e);
  }
}

/** Track once per user (e.g. onboarding_started). */
export async function trackEventOnce(name: EventName): Promise<void> {
  try {
    const supabase = await createClient();
    const { data } = await supabase.auth.getUser();
    if (!data.user) return;
    // events are insert-only for students, so check via profile state instead of reading events
    const { count } = await supabase
      .from("events")
      .select("id", { count: "exact", head: true })
      .eq("user_id", data.user.id)
      .eq("event_name", name);
    if ((count ?? 0) === 0) await trackEvent(name);
  } catch (e) {
    console.error("[analytics] once failed", name, e);
  }
}
