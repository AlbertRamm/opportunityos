import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { SITE_URL } from "@/lib/config";
import { todayET } from "@/lib/dates";
import { emailConfigured, sendEmail } from "@/lib/email";
import { buildReminderEmail, signUnsubscribeToken, type DueReminder } from "@/lib/reminders";
import { createAnonClient } from "@/lib/supabase/anon";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(req: NextRequest, secret: string): boolean {
  const given = Buffer.from(req.headers.get("authorization") ?? "");
  const want = Buffer.from(`Bearer ${secret}`);
  return given.length === want.length && timingSafeEqual(given, want);
}

/**
 * Daily job (Vercel Cron → GET with `Authorization: Bearer $CRON_SECRET`).
 * The database decides who is due and records a claim per (student, opportunity, kind, deadline) BEFORE we send,
 * so overlapping/repeated runs can't double-send. Failed sends stay pending and are retried (max 3 attempts).
 */
export async function GET(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 32) return NextResponse.json({ error: "CRON_SECRET (32+ chars) is not configured" }, { status: 503 });
  if (!authorized(req, secret)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  // Don't claim anything if we couldn't send it.
  if (!emailConfigured()) return NextResponse.json({ error: "SMTP_* / EMAIL_FROM are not configured; nothing claimed" }, { status: 503 });

  const db = createAnonClient();
  const { data, error } = await db.rpc("claim_due_reminders", { p_secret: secret, p_today: todayET() });
  if (error) {
    console.error("[reminders] claim failed", error.message);
    return NextResponse.json({ error: "claim failed" }, { status: 500 });
  }

  const rows = (data ?? []) as DueReminder[];
  let sent = 0;
  let failed = 0;
  for (const r of rows) {
    let ok = false;
    try {
      const unsubscribeUrl = `${SITE_URL.replace(/\/$/, "")}/unsubscribe?t=${encodeURIComponent(signUnsubscribeToken(r.user_id, process.env.UNSUBSCRIBE_SECRET || secret))}`;
      const mail = buildReminderEmail(r, SITE_URL, unsubscribeUrl);
      await sendEmail({ to: r.email, ...mail, unsubscribeUrl });
      ok = true;
    } catch (e) {
      console.error("[reminders] send failed", r.log_id, (e as Error).message); // never log the address
    }
    const { error: cErr } = await db.rpc("confirm_reminder", { p_secret: secret, p_log_id: r.log_id, p_ok: ok });
    if (cErr) console.error("[reminders] confirm failed", r.log_id, cErr.message);
    if (ok) sent++;
    else failed++;
  }
  return NextResponse.json({ claimed: rows.length, sent, failed });
}
