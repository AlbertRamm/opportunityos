import "server-only";
import nodemailer from "nodemailer";

/** SMTP settings come from env only. If any are missing, reminders are disabled (never half-run). */
export function emailConfigured(): boolean {
  return Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS && process.env.EMAIL_FROM);
}

export async function sendEmail(msg: { to: string; subject: string; text: string; html: string; unsubscribeUrl: string }): Promise<void> {
  const port = Number(process.env.SMTP_PORT) || 465;
  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
    connectionTimeout: 10_000,
    socketTimeout: 20_000,
  });
  await transport.sendMail({
    from: process.env.EMAIL_FROM,
    to: msg.to,
    subject: msg.subject,
    text: msg.text,
    html: msg.html,
    headers: { "List-Unsubscribe": `<${msg.unsubscribeUrl}>` },
  });
}
