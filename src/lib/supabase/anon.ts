import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/config";

/** Session-less anon client, for server jobs that authenticate with a shared secret (reminders). Not a service-role key. */
export function createAnonClient() {
  return createSupabaseClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), requireEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
