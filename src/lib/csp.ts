// Content-Security-Policy builder. Pure so it can be unit-tested.
// The browser never talks to Supabase directly (all auth/data calls happen on the server), so connect-src is 'self'.
export type CspMode = "enforce" | "report-only" | "off";

export function cspMode(raw: string | undefined): CspMode {
  return raw === "report-only" || raw === "off" ? raw : "enforce";
}

export function buildCsp(nonce: string, isDev: boolean): string {
  const directives = [
    "default-src 'self'",
    // 'strict-dynamic' lets nonce'd Next scripts load their chunks; 'self' is ignored by modern browsers when it is present.
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isDev ? " 'unsafe-eval'" : ""}`,
    `style-src 'self' 'nonce-${nonce}'`,
    "style-src-attr 'unsafe-inline'", // React style={{…}} attributes (e.g. funnel bars); cannot execute script
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'" + (isDev ? " ws: wss:" : ""),
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isDev ? [] : ["upgrade-insecure-requests"]),
  ];
  return directives.join("; ");
}

export function cspHeaderName(mode: CspMode): string | null {
  if (mode === "off") return null;
  return mode === "report-only" ? "Content-Security-Policy-Report-Only" : "Content-Security-Policy";
}
