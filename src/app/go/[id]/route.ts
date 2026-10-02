import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOpportunity, getUser } from "@/lib/data";
import { safeHttpUrl } from "@/lib/opportunities";
import { trackEvent } from "@/lib/analytics";

// Logs an *application link click* (not an application) and forwards to the official page.
// The destination always comes from our database, never from the request.
export async function GET(request: NextRequest, ctx: RouteContext<"/go/[id]">) {
  const { id } = await ctx.params;
  const user = await getUser();
  if (!user) {
    return NextResponse.redirect(new URL(`/start?next=${encodeURIComponent(`/opportunities/${id}`)}`, request.url));
  }
  const opp = await getOpportunity(id);
  const target = safeHttpUrl(opp?.applicationUrl);
  if (!opp || !target) return NextResponse.redirect(new URL("/dashboard", request.url));

  const supabase = await createClient();
  await supabase
    .from("student_opportunities")
    .upsert(
      { user_id: user.id, opportunity_id: opp.id, apply_clicked_at: new Date().toISOString() },
      { onConflict: "user_id,opportunity_id" },
    );
  await trackEvent("application_link_clicked", { opportunityId: opp.id });
  return NextResponse.redirect(target, 302);
}
