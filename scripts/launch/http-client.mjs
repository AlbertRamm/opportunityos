// Minimal HTTP "browser" for the live smoke test (no Chromium, no custom trust store).
// It uses Node's own fetch, i.e. the same TLS verification the public smoke checks use. Nothing here disables
// certificate checks. It speaks the same protocol a browser does: cookies, plain <form> posts (progressive
// enhancement) and Next server-action calls (`Next-Action` header) for the client-side buttons.

/** Cookies for exactly one origin. Cookies are never sent anywhere else and never accepted from anywhere else. */
export class CookieJar {
  #cookies = new Map();
  constructor(origin) { this.origin = new URL(origin).origin; }
  /** Apply Set-Cookie header values (an array, as from `headers.getSetCookie()`). */
  store(setCookies) {
    for (const line of setCookies ?? []) {
      const [pair, ...attrs] = line.split(";").map((s) => s.trim());
      const eq = pair.indexOf("=");
      if (eq < 1) continue;
      const name = pair.slice(0, eq);
      const value = pair.slice(eq + 1);
      let expired = value === "";
      for (const a of attrs) {
        const [k, v = ""] = a.split("=");
        if (/^max-age$/i.test(k) && Number(v) <= 0) expired = true;
        if (/^expires$/i.test(k) && Date.parse(v) <= Date.now()) expired = true;
      }
      if (expired) this.#cookies.delete(name);
      else this.#cookies.set(name, value);
    }
  }
  /** Serialize / restore (for resuming an interrupted smoke run without another email). */
  toJSON() { return { origin: this.origin, cookies: [...this.#cookies] }; }
  load(data) { if (data?.origin === this.origin) for (const [k, v] of data.cookies ?? []) this.#cookies.set(k, v); return this; }
  header() { return [...this.#cookies].map(([k, v]) => `${k}=${v}`).join("; "); }
  names() { return [...this.#cookies.keys()]; }
}

export class HttpSession {
  constructor(base) {
    this.base = new URL(base).origin;
    this.jar = new CookieJar(this.base);
  }
  /** One request, redirects NOT followed. `path` must be same-origin. */
  async request(path, { method = "GET", headers = {}, body } = {}) {
    const url = new URL(path, this.base);
    if (url.origin !== this.base) throw new Error(`refusing cross-origin request to ${url.origin}`);
    const cookie = this.jar.header();
    const res = await fetch(url, {
      method, body, redirect: "manual",
      headers: { origin: this.base, "user-agent": "opportunityos-smoke/1", ...(cookie ? { cookie } : {}), ...headers },
    });
    this.jar.store(res.headers.getSetCookie?.());
    return res;
  }
  /** GET following same-origin redirects only (a redirect off-site stops and is reported, never fetched). */
  async get(path, max = 8) {
    let current = path;
    for (let i = 0; i <= max; i++) {
      const res = await this.request(current);
      const loc = res.headers.get("location");
      if (res.status >= 300 && res.status < 400 && loc) {
        const next = new URL(loc, this.base);
        if (next.origin !== this.base) return { status: res.status, path: current, url: next.toString(), offsite: true, text: "", res };
        current = next.pathname + next.search;
        continue;
      }
      const text = await res.text();
      // Streamed pages (those with a loading.tsx) have already sent "200" when redirect() runs; Next then emits a
      // <meta id="__next-page-redirect" http-equiv="refresh" content="1;url=…"> that a browser follows. Do the same.
      const meta = pageRedirect(text);
      if (res.status === 200 && meta) {
        const next = new URL(meta, this.base);
        if (next.origin !== this.base) return { status: 200, path: current, url: next.toString(), offsite: true, text, res };
        current = next.pathname + next.search;
        continue;
      }
      return { status: res.status, path: current, url: new URL(current, this.base).toString(), text, res };
    }
    throw new Error(`too many redirects starting at ${path}`);
  }
  /** Submit a parsed form like a no-JS browser: multipart POST, redirects followed afterwards. */
  async submitForm(path, form, overrides = {}) {
    const fd = buildFormData(form, overrides);
    const res = await this.request(path, { method: "POST", body: fd });
    const loc = res.headers.get("location");
    if (res.status >= 300 && res.status < 400 && loc) {
      const next = new URL(loc, this.base);
      const landed = await this.get(next.pathname + next.search);
      return { ...landed, redirectedTo: next.pathname + next.search, postStatus: res.status };
    }
    return { status: res.status, path, text: await res.text(), postStatus: res.status };
  }
  /** Call a Next server action the way the client runtime does. Returns {value, redirect}. */
  async callAction(pagePath, actionId, args) {
    const res = await this.request(pagePath, {
      method: "POST",
      headers: { accept: "text/x-component", "next-action": actionId, "content-type": "text/plain;charset=UTF-8" },
      body: JSON.stringify(args),
    });
    const text = await res.text();
    return { status: res.status, value: parseFlightValue(text), redirect: res.headers.get("x-action-redirect"), text };
  }
}

/** Visible validation messages on a page (role="alert" elements), for diagnosing a rejected form post. */
export function alerts(html) {
  return [...html.matchAll(/<([a-z0-9]+)\b[^>]*role="alert"[^>]*>([\s\S]*?)<\/\1>/gi)].map((m) => decode(m[2].replace(/<[^>]+>/g, "")).trim()).filter(Boolean);
}

/** Target of Next's streamed-redirect meta tag, or null. */
export function pageRedirect(html) {
  const tag = /<meta\b[^>]*id="__next-page-redirect"[^>]*>/i.exec(html)?.[0];
  return tag ? (/content="\s*\d+\s*;\s*url=([^"]+)"/i.exec(tag)?.[1] ?? null) : null;
}

// ---------------------------------------------------------------- HTML helpers (no DOM available in plain Node)
const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
function attrs(tag) {
  const out = {};
  for (const m of tag.matchAll(/([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g)) {
    if (m[1] === "input" || m[1] === "select" || m[1] === "textarea" || m[1] === "option" || m[1] === "form") continue;
    out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? "");
  }
  return out;
}

/** Every <form> on the page with its successful-control candidates (inputs, selects, textareas). */
export function parseForms(html) {
  const forms = [];
  for (const fm of html.matchAll(/<form\b([^>]*)>([\s\S]*?)<\/form>/gi)) {
    const form = { attrs: attrs(fm[1]), fields: [] };
    const inner = fm[2];
    for (const im of inner.matchAll(/<input\b([^>]*)>/gi)) {
      const a = attrs(im[1]);
      if (!a.name) continue;
      form.fields.push({ name: a.name, type: (a.type ?? "text").toLowerCase(), value: a.value ?? (["checkbox", "radio"].includes(a.type) ? "on" : ""), checked: "checked" in a, disabled: "disabled" in a });
    }
    for (const sm of inner.matchAll(/<select\b([^>]*)>([\s\S]*?)<\/select>/gi)) {
      const a = attrs(sm[1]);
      if (!a.name) continue;
      const options = [...sm[2].matchAll(/<option\b([^>]*)>([\s\S]*?)<\/option>/gi)].map((o) => { const oa = attrs(o[1]); return { value: oa.value ?? decode(o[2]), selected: "selected" in oa }; });
      form.fields.push({ name: a.name, type: "select", options, value: (options.find((o) => o.selected) ?? options[0])?.value ?? "" });
    }
    forms.push(form);
  }
  return forms;
}

export const findForm = (html, pred) => parseForms(html).find(pred);

/** Browser-equivalent form data: hidden/text fields and checked boxes/radios, with `overrides` (name → string | string[] | null) applied. */
export function buildFormData(form, overrides = {}) {
  const fd = new FormData();
  const overridden = new Set(Object.keys(overrides));
  for (const f of form.fields) {
    if (f.disabled || overridden.has(f.name)) continue;
    if ((f.type === "checkbox" || f.type === "radio") && !f.checked) continue;
    if (["submit", "button", "image", "file"].includes(f.type)) continue;
    fd.append(f.name, f.value);
  }
  for (const [name, v] of Object.entries(overrides)) {
    if (v === null || v === undefined) continue;
    for (const one of Array.isArray(v) ? v : [v]) fd.append(name, one);
  }
  return fd;
}

/** Current value(s) a form would submit for `name` (used to prove a save persisted). */
export const fieldValue = (form, name) => form.fields.filter((f) => f.name === name && (f.type !== "checkbox" && f.type !== "radio" || f.checked)).map((f) => f.value);

// ---------------------------------------------------------------- Next server actions
/** Script URLs the page can load (inline script tags plus chunk paths named inside the RSC payload). */
export function chunkUrls(html) {
  const set = new Set();
  for (const m of html.matchAll(/(?:\/_next\/)?static\/(?:immutable\/)?chunks\/[A-Za-z0-9_\-./~%]+\.js/g)) set.add(m[0].startsWith("/_next/") ? m[0] : `/_next/${m[0]}`);
  return [...set];
}

/** `createServerReference("<id>", …, "<exportName>")` pairs inside a client chunk. */
export function actionIdsFromChunk(js) {
  const out = {};
  for (const m of js.matchAll(/\("([0-9a-f]{40,})",[^)]*?,"([A-Za-z0-9_$]+)"\)/g)) out[m[2]] = m[1];
  return out;
}

export async function discoverActions(session, pagePath, html) {
  const found = {};
  for (const u of chunkUrls(html)) {
    const res = await session.request(u);
    if (res.status === 200) Object.assign(found, actionIdsFromChunk(await res.text()));
    else await res.arrayBuffer();
  }
  void pagePath;
  return found;
}

/** First return value of a server action from a flight response (`1:{...}` line). */
export function parseFlightValue(text) {
  for (const line of text.split("\n")) {
    const m = /^1:(.*)$/.exec(line);
    if (m) { try { return JSON.parse(m[1]); } catch { return undefined; } }
  }
  return undefined;
}

// ---------------------------------------------------------------- magic link
/**
 * The link comes from an email, so treat it as untrusted input before fetching: https only, our Supabase project's
 * host only, on its /auth/v1/verify endpoint, and it must send the user back to OUR /auth/callback.
 */
export function checkMagicLink(link, { base, supabaseHost }) {
  let u;
  try { u = new URL(link.trim()); } catch { return { ok: false, why: "not a URL" }; }
  if (u.protocol !== "https:") return { ok: false, why: "not https" };
  if (supabaseHost && u.hostname !== supabaseHost) return { ok: false, why: `host ${u.hostname} is not the expected Supabase host` };
  if (!supabaseHost && !/\.supabase\.co$/.test(u.hostname)) return { ok: false, why: "host is not *.supabase.co" };
  if (u.pathname !== "/auth/v1/verify") return { ok: false, why: "not the /auth/v1/verify endpoint" };
  const redirect = u.searchParams.get("redirect_to") ?? "";
  const origin = new URL(base).origin;
  if (!redirect.startsWith(`${origin}/auth/callback`)) return { ok: false, why: `redirect_to does not target ${origin}/auth/callback` };
  return { ok: true, url: u, redirect };
}

/** Pull the first magic link out of an email body (plain text or HTML-escaped). */
export function extractMagicLink(body, supabaseHost) {
  const re = /https:\/\/[A-Za-z0-9.-]+\/auth\/v1\/verify\?[^\s"'<>]+/g;
  for (const m of decode(body).matchAll(re)) {
    const raw = m[0].replace(/[).,;]+$/, "");
    if (!supabaseHost || new URL(raw).hostname === supabaseHost) return raw;
  }
  return null;
}

/**
 * Follow the link exactly like a browser would, but without ever leaving the two trusted hosts:
 * GET Supabase verify (manual redirect) → Location must be our /auth/callback?code=… → GET it WITH our cookie jar
 * (that carries the PKCE verifier set when we requested the link, so only this "browser" can finish the sign-in).
 */
export async function completeMagicLink(session, link, opts) {
  const chk = checkMagicLink(link, { base: session.base, supabaseHost: opts.supabaseHost });
  if (!chk.ok) return { ok: false, why: chk.why };
  const verify = await fetch(chk.url, { redirect: "manual", headers: { "user-agent": "opportunityos-smoke/1" } });
  const loc = verify.headers.get("location") ?? "";
  await verify.arrayBuffer();
  if (!(verify.status >= 300 && verify.status < 400) || !loc) return { ok: false, why: `Supabase verify answered ${verify.status} with no redirect (link used/expired?)` };
  const back = new URL(loc, chk.url);
  if (back.origin !== session.base || back.pathname !== "/auth/callback") return { ok: false, why: `verify redirected to ${back.origin}${back.pathname}, not our /auth/callback`, redirectTo: `${back.origin}${back.pathname}` };
  if (!back.searchParams.get("code")) return { ok: false, why: "verify redirect carried no ?code= (Supabase error: " + (back.hash || back.searchParams.get("error") || "unknown") + ")" };
  const landed = await session.get(back.pathname + back.search);
  return { ok: true, landed, cookies: session.jar.names() };
}

/** Deterministic "fingerprint" of a rendered page: strips per-request noise (nonces, build asset hashes, RSC stream ids). */
export function normalizeHtml(html) {
  return html
    .replace(/nonce="[^"]*"/g, "")
    .replace(/\/_next\/static\/[^"' )]+/g, "/_next/static/X")
    .replace(/<script\b[\s\S]*?<\/script>/gi, "")
    .replace(/\s+/g, " ")
    .replace(/\$ACTION_[A-Z_]*[:0-9]*"? value="[^"]*"/g, "")
    .trim();
}

/** Titles + match-reason lines from the dashboard's <article> cards (what the student sees). */
export function parseCards(html) {
  return [...html.matchAll(/<article\b[\s\S]*?<\/article>/gi)].map((m) => {
    const a = m[0];
    const id = /href="\/opportunities\/([0-9a-f-]{36})/.exec(a)?.[1] ?? null;
    const title = decode((/<h[23][^>]*>([\s\S]*?)<\/h[23]>/i.exec(a)?.[1] ?? "").replace(/<[^>]+>/g, "")).trim();
    const reasons = [...a.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)].map((r) => decode(r[1].replace(/<[^>]+>/g, "")).trim());
    return { id, title, reasons, sample: /Sample data/.test(a) };
  });
}
