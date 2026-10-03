import { createHmac, timingSafeEqual } from "node:crypto";
import { formatDate } from "@/lib/dates";

export interface DueReminder {
  log_id: number;
  user_id: string;
  email: string;
  first_name: string;
  opportunity_id: string;
  title: string;
  organization: string;
  deadline: string; // YYYY-MM-DD
  kind: "7d" | "2d";
  days_left: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** `<userId>.<hmac>` — lets the email's unsubscribe link work without signing in, and can't be forged for other users. */
export function signUnsubscribeToken(userId: string, secret: string): string {
  const mac = createHmac("sha256", secret).update(`unsub:${userId}`).digest("base64url");
  return `${userId}.${mac}`;
}

export function verifyUnsubscribeToken(token: string | undefined | null, secret: string): string | null {
  if (!token || !secret) return null;
  const i = token.indexOf(".");
  if (i < 0) return null;
  const userId = token.slice(0, i);
  if (!UUID.test(userId)) return null;
  const expected = Buffer.from(signUnsubscribeToken(userId, secret));
  const given = Buffer.from(token);
  return expected.length === given.length && timingSafeEqual(expected, given) ? userId : null;
}

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);

export function buildReminderEmail(r: DueReminder, siteUrl: string, unsubscribeUrl: string) {
  const when = r.days_left === 0 ? "today" : r.days_left === 1 ? "tomorrow" : `in ${r.days_left} days`;
  const date = formatDate(r.deadline);
  const detail = `${siteUrl.replace(/\/$/, "")}/opportunities/${r.opportunity_id}`;
  const subject = r.days_left <= 1 ? `Deadline ${when}: ${r.title}` : `Deadline in ${r.days_left} days: ${r.title}`;
  const text = [
    `Hi ${r.first_name},`,
    "",
    `"${r.title}" (${r.organization}) has an application deadline of ${date} — ${when}.`,
    "",
    `See details and your eligibility: ${detail}`,
    "",
    "Deadlines can change, so confirm on the organization's official page before you apply. OpportunityOS doesn't submit applications for you.",
    "",
    "You're getting this because you saved this opportunity and have deadline reminders turned on.",
    `Turn reminders off: ${unsubscribeUrl}`,
  ].join("\n");
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;line-height:1.5;color:#14171c">
<p>Hi ${esc(r.first_name)},</p>
<p><strong>${esc(r.title)}</strong> (${esc(r.organization)}) has an application deadline of <strong>${esc(date)}</strong> — ${esc(when)}.</p>
<p><a href="${esc(detail)}">See details and your eligibility</a></p>
<p style="color:#5a6270;font-size:14px">Deadlines can change, so confirm on the organization's official page before you apply. OpportunityOS doesn't submit applications for you.</p>
<p style="color:#5a6270;font-size:13px">You're getting this because you saved this opportunity and have deadline reminders turned on. <a href="${esc(unsubscribeUrl)}">Turn reminders off</a>.</p>
</div>`;
  return { subject, text, html };
}
