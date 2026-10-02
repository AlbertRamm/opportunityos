export type FormState<V = Record<string, unknown>> = {
  ok?: boolean;
  error?: string;
  fieldErrors?: Record<string, string>;
  values?: V;
  message?: string;
};

export function str(fd: FormData, key: string): string {
  const v = fd.get(key);
  return typeof v === "string" ? v.trim() : "";
}
export function strOrNull(fd: FormData, key: string): string | null {
  return str(fd, key) || null;
}
export function list(fd: FormData, key: string): string[] {
  return fd.getAll(key).filter((v): v is string => typeof v === "string" && v.trim() !== "").map((v) => v.trim());
}
/** Split free text on commas / newlines. */
export function splitList(s: string, sep: RegExp = /[,\n]/): string[] {
  return s.split(sep).map((x) => x.trim()).filter(Boolean);
}
export function intOrNull(fd: FormData, key: string): number | null {
  const s = str(fd, key);
  if (s === "") return null;
  const n = Number(s);
  return Number.isInteger(n) ? n : NaN;
}

/** Only allow same-site relative redirects (prevents open redirects via ?next=). */
export function safeNext(next: string | null | undefined, fallback = "/dashboard"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.includes("\\")) return fallback;
  return next;
}
