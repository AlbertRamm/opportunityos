import { NextResponse, type NextRequest } from "next/server";
import { safeNext } from "@/lib/forms";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const next = safeNext(url.searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, url.origin));
  }

  const retry = new URL("/start", url.origin);
  retry.searchParams.set("next", next);
  retry.searchParams.set("error", "auth");
  return NextResponse.redirect(retry);
}
