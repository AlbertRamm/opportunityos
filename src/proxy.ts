import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { buildCsp, cspHeaderName, cspMode } from "@/lib/csp";

// Refreshes the Supabase session cookie and does an *optimistic* redirect for signed-out visitors.
// Real authorization happens in server code (requireUser/requireAdmin) and in Postgres RLS.
const PROTECTED = ["/dashboard", "/onboarding", "/saved", "/profile", "/opportunities", "/go", "/admin"];

export async function proxy(request: NextRequest) {
  // Per-request nonce → CSP. Next reads the request-side header to nonce its own scripts/styles.
  const mode = cspMode(process.env.CSP_MODE);
  const headerName = cspHeaderName(mode);
  const nonce = btoa(crypto.randomUUID());
  const csp = buildCsp(nonce, process.env.NODE_ENV === "development");
  const requestHeaders = new Headers(request.headers);
  if (headerName) {
    requestHeaders.set("x-nonce", nonce);
    requestHeaders.set(headerName, csp);
  }
  const next = () => NextResponse.next({ request: { headers: requestHeaders } });
  const withCsp = <T extends NextResponse>(res: T): T => {
    if (headerName) res.headers.set(headerName, csp);
    return res;
  };

  let response = withCsp(next());
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return response; // surfaced with a clear error by server code

  const supabase = createServerClient(url, key, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll(cookiesToSet) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        requestHeaders.set("cookie", request.headers.get("cookie") ?? ""); // keep refreshed session visible to the page render
        response = withCsp(next());
        cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  const isProtected = PROTECTED.some((p) => path === p || path.startsWith(`${p}/`));

  if (!data?.claims && isProtected) {
    const redirect = request.nextUrl.clone();
    redirect.pathname = "/start";
    redirect.search = `?next=${encodeURIComponent(path + request.nextUrl.search)}`;
    return withCsp(NextResponse.redirect(redirect));
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
