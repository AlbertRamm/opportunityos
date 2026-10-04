import { describe, expect, it, vi, afterEach } from "vitest";
import {
  CookieJar, HttpSession, alerts, actionIdsFromChunk, buildFormData, checkMagicLink, chunkUrls, completeMagicLink,
  extractMagicLink, fieldValue, normalizeHtml, pageRedirect, parseCards, parseFlightValue, parseForms,
} from "./http-client.mjs";

const BASE = "https://opportunityos-ochre.vercel.app";
const SB = "abc.supabase.co";

describe("CookieJar", () => {
  it("stores, overwrites and deletes cookies (Max-Age=0, past Expires, empty value)", () => {
    const j = new CookieJar(BASE);
    j.store(["a=1; Path=/; HttpOnly", "b=2; Path=/; Secure"]);
    expect(j.header()).toBe("a=1; b=2");
    j.store(["a=9; Path=/", "b=; Max-Age=0; Path=/"]);
    expect(j.header()).toBe("a=9");
    j.store(["a=9; Expires=Thu, 01 Jan 1970 00:00:00 GMT"]);
    expect(j.names()).toEqual([]);
  });
});

describe("CookieJar persistence (resume without another email)", () => {
  it("round-trips, and refuses a state file saved for a different origin", () => {
    const a = new CookieJar(BASE);
    a.store(["sb-x-auth-token=t1; Path=/", "k=v"]);
    const saved = JSON.parse(JSON.stringify(a));
    expect(new CookieJar(BASE).load(saved).header()).toBe("sb-x-auth-token=t1; k=v");
    expect(new CookieJar("https://other.example").load(saved).header()).toBe("");
    expect(new CookieJar(BASE).load(null).header()).toBe("");
  });
});

describe("alerts", () => {
  it("lists visible validation messages", () => {
    const html = `<p id="a" role="alert" class="x">Enter your <b>first</b> name</p><div role="alert"></div><p role="alert">ZIP 20001 is in DC, not MD.</p>`;
    expect(alerts(html)).toEqual(["Enter your first name", "ZIP 20001 is in DC, not MD."]);
  });
});

describe("HttpSession", () => {
  afterEach(() => vi.unstubAllGlobals());
  it("refuses cross-origin requests and never sends cookies off-origin", async () => {
    const fetchMock = vi.fn(async () => new Response("", { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    const s = new HttpSession(BASE);
    s.jar.store(["sb-x-auth-token=secret"]);
    await expect(s.request("https://evil.example/steal")).rejects.toThrow(/cross-origin/);
    expect(fetchMock).not.toHaveBeenCalled();
    await s.request("/dashboard");
    expect(fetchMock.mock.calls[0][1].headers.cookie).toBe("sb-x-auth-token=secret");
  });
  it("stops at an off-site redirect instead of fetching it", async () => {
    const calls = [];
    vi.stubGlobal("fetch", async (u) => { calls.push(String(u)); return new Response("", { status: 302, headers: { location: "https://www.nist.gov/ship" } }); });
    const r = await new HttpSession(BASE).get("/go/x");
    expect(r.offsite).toBe(true);
    expect(calls).toEqual([`${BASE}/go/x`]);
  });
  it("follows same-origin redirects and keeps cookies from each hop", async () => {
    let n = 0;
    vi.stubGlobal("fetch", async () => {
      n++;
      if (n === 1) { const h = new Headers({ location: "/dashboard" }); h.append("set-cookie", "s=1; Path=/"); return new Response("", { status: 307, headers: h }); }
      return new Response("<h1>ok</h1>", { status: 200 });
    });
    const s = new HttpSession(BASE);
    const r = await s.get("/x");
    expect(r.path).toBe("/dashboard");
    expect(s.jar.header()).toBe("s=1");
  });
});

const HTML = `<form action="" method="POST"><input type="hidden" name="$ACTION_REF_1"/><input type="hidden" name="$ACTION_1:0" value="[&quot;a&quot;]"/>
<input id="email" name="email" type="email" value=""/><input type="checkbox" name="age13"/>
<input type="checkbox" name="interests" value="cs" checked=""/><input type="checkbox" name="interests" value="art"/>
<input type="radio" name="pay" value="either" checked=""/><input type="radio" name="pay" value="paid"/>
<select name="grade"><option value="9">9</option><option value="10" selected="">10</option></select>
<input name="off" value="x" disabled=""/></form><form><input name="q"/></form>`;

describe("streamed redirects (pages with loading.tsx answer 200 + meta refresh)", () => {
  afterEach(() => vi.unstubAllGlobals());
  const meta = (u) => `<html><head><meta id="__next-page-redirect" http-equiv="refresh" content="1;url=${u}"/></head><body></body></html>`;
  it("extracts the target", () => {
    expect(pageRedirect(meta("/onboarding"))).toBe("/onboarding");
    expect(pageRedirect("<meta http-equiv='refresh' content='5;url=/x'>")).toBeNull(); // only Next's own marker
    expect(pageRedirect("<p>nothing</p>")).toBeNull();
  });
  it("follows it like a browser, same-origin only", async () => {
    const pages = { "/dashboard": meta("/onboarding"), "/onboarding": "<h1>Welcome</h1>" };
    vi.stubGlobal("fetch", async (u) => new Response(pages[new URL(String(u)).pathname] ?? "", { status: 200 }));
    expect((await new HttpSession(BASE).get("/dashboard")).path).toBe("/onboarding");
    vi.stubGlobal("fetch", async () => new Response(meta("https://evil.example/x"), { status: 200 }));
    const r = await new HttpSession(BASE).get("/dashboard");
    expect(r.offsite).toBe(true);
  });
});

describe("forms", () => {
  const [f, g] = parseForms(HTML);
  it("parses every form and its controls", () => {
    expect(parseForms(HTML)).toHaveLength(2);
    expect(g.fields.map((x) => x.name)).toEqual(["q"]);
    expect(fieldValue(f, "grade")).toEqual(["10"]);
    expect(fieldValue(f, "interests")).toEqual(["cs"]);
  });
  it("builds browser-equivalent form data: hidden fields kept, unchecked/disabled dropped, overrides applied", () => {
    const fd = buildFormData(f, { email: "a@b.co", age13: "on", interests: ["cs", "art"], pay: null });
    expect([...fd.keys()]).toContain("$ACTION_REF_1");
    expect(fd.get("$ACTION_1:0")).toBe('["a"]'); // HTML entities decoded
    expect(fd.get("email")).toBe("a@b.co");
    expect(fd.getAll("interests")).toEqual(["cs", "art"]);
    expect(fd.get("age13")).toBe("on");
    expect(fd.get("grade")).toBe("10");
    expect(fd.has("off")).toBe(false);
    expect(fd.has("pay")).toBe(false); // explicit null removes the control
  });
});

describe("server actions", () => {
  const id = "60e0b7744bd5c1b4ec52db01d79404ba82a6dd7666";
  const js = `a=(0,s.createServerReference)("${id}",s.callServer,void 0,s.findSourceMapURL,"setApplicationStatus");b=(0,s.createServerReference)("604db5bbbbaaab38a2ff2f11084434aa9c58392378",s.callServer,void 0,s.findSourceMapURL,"toggleSave")`;
  it("maps export names to ids from a client chunk", () => {
    expect(actionIdsFromChunk(js)).toEqual({ setApplicationStatus: id, toggleSave: "604db5bbbbaaab38a2ff2f11084434aa9c58392378" });
  });
  it("finds chunk urls in script tags and in the RSC payload", () => {
    const html = `<script src="/_next/static/chunks/a1.js" async></script><script>self.__next_f.push([1,"[\\"static/chunks/b2-x.js\\"]"])</script>`;
    expect(chunkUrls(html).sort()).toEqual(["/_next/static/chunks/a1.js", "/_next/static/chunks/b2-x.js"]);
  });
  it("finds chunk urls under /static/immutable/chunks (Next 16 production output)", () => {
    expect(chunkUrls('<script src="/_next/static/immutable/chunks/28fkf9.js" async=""></script>')).toEqual(["/_next/static/immutable/chunks/28fkf9.js"]);
  });
  it("parses a flight response return value", () => {
    expect(parseFlightValue('0:{"a":"$@1","f":""}\n1:{"ok":true}\n')).toEqual({ ok: true });
    expect(parseFlightValue("garbage")).toBeUndefined();
  });
});

describe("magic link handling (untrusted input from email)", () => {
  const good = `https://${SB}/auth/v1/verify?token=pkce_x&type=magiclink&redirect_to=${encodeURIComponent(BASE + "/auth/callback?next=%2Fdashboard")}`;
  it("accepts only our Supabase host, verify endpoint, https and our callback", () => {
    expect(checkMagicLink(good, { base: BASE, supabaseHost: SB }).ok).toBe(true);
    expect(checkMagicLink(good.replace(SB, "evil.example"), { base: BASE, supabaseHost: SB }).ok).toBe(false);
    expect(checkMagicLink(good.replace("https:", "http:"), { base: BASE, supabaseHost: SB }).ok).toBe(false);
    expect(checkMagicLink(good.replace("/auth/v1/verify", "/other"), { base: BASE, supabaseHost: SB }).ok).toBe(false);
    expect(checkMagicLink(good.replace(encodeURIComponent(BASE), encodeURIComponent("https://evil.example")), { base: BASE, supabaseHost: SB }).ok).toBe(false);
    expect(checkMagicLink("not a url", { base: BASE }).ok).toBe(false);
    expect(checkMagicLink(good.replace(SB, "evil.example"), { base: BASE }).ok).toBe(false); // no pinned host: must still be *.supabase.co
  });
  it("extracts the link from an email body, including HTML-escaped ampersands", () => {
    const body = `Hi\n<a href="${good.replace(/&/g, "&amp;")}">Log in</a>\nhttps://other.example/auth/v1/verify?x=1`;
    expect(extractMagicLink(body, SB)).toBe(good);
    expect(extractMagicLink("no link here", SB)).toBeNull();
  });
  afterEach(() => vi.unstubAllGlobals());
  it("completes the flow only if Supabase redirects to our callback with a code, and uses our cookie jar for the exchange", async () => {
    const seen = [];
    vi.stubGlobal("fetch", async (u, init) => {
      seen.push([String(u), init?.headers?.cookie]);
      if (String(u).startsWith(`https://${SB}`)) return new Response("", { status: 303, headers: { location: `${BASE}/auth/callback?code=c1&next=%2Fdashboard` } });
      if (String(u).includes("/auth/callback")) return new Response("", { status: 307, headers: { location: "/onboarding" } });
      return new Response("<h1>Welcome</h1>", { status: 200 });
    });
    const s = new HttpSession(BASE);
    s.jar.store(["sb-x-auth-token-code-verifier=v"]);
    const r = await completeMagicLink(s, good, { supabaseHost: SB });
    expect(r.ok).toBe(true);
    expect(r.landed.path).toBe("/onboarding");
    expect(seen[0][1]).toBeUndefined(); // our cookies are not sent to Supabase
    expect(seen[1][1]).toBe("sb-x-auth-token-code-verifier=v");
  });
  it("rejects a verify redirect that leaves our site or carries no code", async () => {
    vi.stubGlobal("fetch", async () => new Response("", { status: 303, headers: { location: "https://evil.example/auth/callback?code=1" } }));
    expect((await completeMagicLink(new HttpSession(BASE), good, { supabaseHost: SB })).ok).toBe(false);
    vi.stubGlobal("fetch", async () => new Response("", { status: 303, headers: { location: `${BASE}/auth/callback` } }));
    expect((await completeMagicLink(new HttpSession(BASE), good, { supabaseHost: SB })).ok).toBe(false);
  });
});

describe("page helpers", () => {
  it("normalizes nonces, asset hashes and scripts so equal renders compare equal", () => {
    const a = `<link href="/_next/static/css/aaa.css"/><div nonce="N1"> hi </div><script nonce="N1">x</script>`;
    const b = `<link href="/_next/static/css/bbb.css"/><div nonce="N2">  hi </div><script nonce="N2">y</script>`;
    expect(normalizeHtml(a)).toBe(normalizeHtml(b));
    expect(normalizeHtml(a)).not.toBe(normalizeHtml("<div>other</div>"));
  });
  it("parses dashboard cards", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const html = `<article><h3>NIST &amp; Co</h3><span>Sample data</span><ul><li>Open to grade 10</li><li><b>Paid</b></li></ul><a href="/opportunities/${id}">View details</a></article>`;
    expect(parseCards(html)).toEqual([{ id, title: "NIST & Co", reasons: ["Open to grade 10", "Paid"], sample: true }]);
  });
});
