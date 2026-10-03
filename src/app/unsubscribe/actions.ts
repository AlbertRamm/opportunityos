"use server";

import { verifyUnsubscribeToken } from "@/lib/reminders";
import { createAnonClient } from "@/lib/supabase/anon";

export async function unsubscribe(_prev: { done?: boolean; error?: string }, fd: FormData): Promise<{ done?: boolean; error?: string }> {
  const secret = process.env.CRON_SECRET;
  const token = String(fd.get("t") ?? "");
  const userId = secret ? verifyUnsubscribeToken(token, process.env.UNSUBSCRIBE_SECRET || secret) : null;
  if (!userId || !secret) return { error: "This link isn't valid. Sign in and turn reminders off on your Profile page." };
  const { error } = await createAnonClient().rpc("unsubscribe_reminders", { p_secret: secret, p_user: userId });
  if (error) {
    console.error("[unsubscribe] failed", error.message);
    return { error: "Something went wrong. Please try again, or turn reminders off on your Profile page." };
  }
  return { done: true };
}
