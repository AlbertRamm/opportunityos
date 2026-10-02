export function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing environment variable ${name}. Copy .env.example to .env.local and fill it in.`);
  return v;
}

export const REVERIFY_AFTER_DAYS = Math.max(1, Number(process.env.REVERIFY_AFTER_DAYS) || 30);
export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
export const APPLY_SOON_DAYS = 14;
