#!/usr/bin/env node
// Sends ONE plain test email through the same SMTP settings the reminder job uses. Prints only the outcome, never credentials.
//   SMTP_HOST=smtp.gmail.com SMTP_PORT=465 SMTP_USER=… SMTP_PASS=… EMAIL_FROM="OpportunityOS <…>" node scripts/launch/smtp-test.mjs you@mailbox
import nodemailer from "nodemailer";

const to = process.argv[2];
const missing = ["SMTP_HOST", "SMTP_USER", "SMTP_PASS", "EMAIL_FROM"].filter((k) => !process.env[k]);
if (!to || missing.length) {
  console.error(`usage: node scripts/launch/smtp-test.mjs <recipient>   (missing env: ${missing.join(", ") || "none"})`);
  process.exit(2);
}
const port = Number(process.env.SMTP_PORT) || 465;
const t = nodemailer.createTransport({ host: process.env.SMTP_HOST, port, secure: port === 465, auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }, connectionTimeout: 10000, socketTimeout: 20000 });
try {
  await t.verify();
  const info = await t.sendMail({
    from: process.env.EMAIL_FROM, to, subject: "OpportunityOS SMTP test",
    text: "If you can read this, OpportunityOS can send email through this SMTP account.",
  });
  console.log(`✓ SMTP login + send OK. accepted=${JSON.stringify(info.accepted)} rejected=${JSON.stringify(info.rejected)} messageId=${info.messageId}`);
} catch (e) {
  // nodemailer error codes (EAUTH, ECONNECTION, ETIMEDOUT…) are safe to print; the password is never in them.
  console.error(`✗ SMTP failed: ${e.code ?? "ERR"} — ${String(e.message).replace(process.env.SMTP_PASS, "***")}`);
  if (e.code === "EAUTH") console.error("  → wrong username/app password (use the 16-char app password, no spaces; 2-Step Verification must be on).");
  process.exit(1);
}
