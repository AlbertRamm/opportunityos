"use client";

import { useEffect, useRef } from "react";
import { pingSession, trackClientEvent } from "@/app/actions";

/** Fires one analytics event per mount (client-side so prefetch/crawlers of the server page don't count). */
export function TrackEvent({ name, opportunityId }: { name: "landing_page_view" | "opportunity_viewed" | "onboarding_started"; opportunityId?: string }) {
  const fired = useRef(false);
  useEffect(() => {
    if (fired.current) return;
    fired.current = true;
    void trackClientEvent(name, opportunityId).catch(() => {});
  }, [name, opportunityId]);
  return null;
}

/** Once per browser session, lets the server decide whether this is a returning visit. */
export function SessionPing() {
  useEffect(() => {
    try {
      if (sessionStorage.getItem("oos_ping")) return;
      sessionStorage.setItem("oos_ping", "1");
    } catch {
      /* storage blocked: still ping, server dedupes per day */
    }
    void pingSession().catch(() => {});
  }, []);
  return null;
}
