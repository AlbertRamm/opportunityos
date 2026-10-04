#!/usr/bin/env node
// Live smoke test. Two modes:
//   PUBLIC (no login):   BASE_URL=https://opportunityos-ochre.vercel.app node scripts/launch/live-smoke.mjs
//   FULL (real account): add SMOKE_EMAIL=<readable mailbox>  [SMOKE_LINK_FILE=/path]  [SMOKE_CLEANUP=1]
//        Default: HTTP-driven (no browser; Node fetch + normal TLS verification, so it works wherever the public checks work).
//        Set CHROMIUM_PATH (+ `playwright-core`) to drive a real browser instead (also covers hydration/CSP console errors).
//        Either way it requests a real magic link, then waits for you (or an agent with mailbox access) to put the emailed
//        link in SMOKE_LINK_FILE (HTTP mode requires the file; browser mode can also read stdin).
//        Optional: SMOKE_STATE_FILE (0600; saves the session so an interrupted run can resume + clean up with NO new email; deleted after cleanup),
//        SUPABASE_URL (pins the expected link host), SMOKE_HIDDEN_OPPORTUNITY_ID (an unverified draft id that must stay invisible).
//        Use a dedicated test mailbox; SMOKE_CLEANUP=1 deletes that account at the end so analytics stay clean.
import fs from "node:fs";
import readline from "node:readline";

const BASE = (process.env.BASE_URL ?? "http://localhost:3000").replace(/\/$/, "");
let failed = 0;
const ok = (c, m) => { if (c) console.log("✓", m); else { failed++; console.log("✗ FAILED:", m); } };
const get = (p, init = {}) => fetch(BASE + p, { redirect: "manual", ...init });
const UUID = "00000000-0000-4000-8000-000000000000";

// ---------------------------------------------------------------- public checks
console.log(`== PUBLIC checks against ${BASE}`);
const home = await get("/");
ok(home.status === 200 && /Stop searching/.test(await home.text()), "landing page renders");
const csp = home.headers.get("content-security-policy") ?? "";
ok(/script-src[^;]*'nonce-/.test(csp) && /frame-ancestors 'none'/.test(csp), "Content-Security-Policy present (nonce-based, no framing)");
const csp2 = (await get("/")).headers.get("content-security-policy") ?? "";
ok(csp !== csp2, "CSP nonce changes per request");
const h = home.headers;
ok(h.get("x-content-type-options") === "nosniff" && h.get("x-frame-options") === "DENY" && /max-age/.test(h.get("strict-transport-security") ?? "") && h.get("referrer-policy"), "security headers present");
ok(!h.get("x-powered-by"), "no X-Powered-By");
for (const p of ["/privacy", "/start"]) ok((await get(p)).status === 200, `${p} → 200`);
for (const p of ["/dashboard", "/saved", "/profile", "/onboarding", "/admin", "/admin/analytics", "/admin/import", "/admin/opportunities/new", `/opportunities/${UUID}`, `/go/${UUID}`, `/admin/opportunities/${UUID}`]) {
  const r = await get(p);
  ok(r.status === 307 && (r.headers.get("location") ?? "").includes("/start"), `signed-out ${p} → redirected to /start`);
}
const cb = await get("/auth/callback?code=not-a-real-code&next=/dashboard");
ok(cb.status >= 300 && cb.status < 400 && /\/start\?.*error=auth/.test(cb.headers.get("location") ?? ""), "bad auth code → back to /start with an error (no session)");
const evil = await get("/auth/callback?code=x&next=https://evil.example");
ok(!/evil\.example/.test(evil.headers.get("location") ?? ""), "open-redirect via ?next= is refused");
const c0 = await get("/api/cron/reminders"); ok([401, 503].includes(c0.status), `cron endpoint rejects anonymous callers (${c0.status}${c0.status === 503 ? " — CRON_SECRET not configured yet" : ""})`);
const c1 = await get("/api/cron/reminders", { headers: { authorization: "Bearer wrong" } }); ok([401, 503].includes(c1.status), "cron endpoint rejects a wrong bearer token");
const un = await get("/unsubscribe?t=bad"); ok(/isn.t valid|isn&#x27;t valid/.test(await un.text()), "forged unsubscribe token is refused");

// ---------------------------------------------------------------- full authenticated flow
const email = process.env.SMOKE_EMAIL;
if (email && !process.env.CHROMIUM_PATH) {
  if (!process.env.SMOKE_LINK_FILE) { failed++; console.log("✗ FAILED: HTTP mode needs SMOKE_LINK_FILE (the file the emailed link is written to)"); }
  else {
    const { runHttpFlow } = await import("./smoke-http-flow.mjs");
    await runHttpFlow({
      base: BASE, email, linkFile: process.env.SMOKE_LINK_FILE, stateFile: process.env.SMOKE_STATE_FILE, cleanup: process.env.SMOKE_CLEANUP === "1",
      supabaseHost: process.env.SUPABASE_URL ? new URL(process.env.SUPABASE_URL).hostname : undefined,
      hiddenOpportunityId: process.env.SMOKE_HIDDEN_OPPORTUNITY_ID, ok,
    });
  }
} else if (email) {
  console.log(`\n== FULL flow with a real account (${email.replace(/(.).+(@.+)/, "$1***$2")})`);
  const { chromium } = await import("playwright-core");
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH, args: ["--no-sandbox"] });
  const ctx = await browser.newContext({ viewport: { width: 1100, height: 900 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  await page.addInitScript(() => document.addEventListener("securitypolicyviolation", (e) => console.error("CSP VIOLATION " + e.violatedDirective + " " + e.blockedURI)));

  await page.goto(BASE + "/start");
  await page.fill("#email", email); await page.check("input[name=age13]");
  await page.getByRole("button", { name: "Email me a sign-in link" }).click();
  const sent = await page.getByText("We emailed a secure sign-in link").waitFor({ timeout: 30000 }).then(() => true).catch(() => false);
  ok(sent, "sign-in form accepted the request (Supabase returned success)");
  if (!sent) { console.log("   error shown:", await page.locator("[role=alert]").allInnerTexts()); }

  console.log("WAITING_FOR_LINK — put the full magic link from the email into SMOKE_LINK_FILE (or paste here and press Enter)");
  const link = await new Promise((resolve) => {
    const file = process.env.SMOKE_LINK_FILE;
    const t0 = Date.now();
    if (file) { const iv = setInterval(() => { try { const v = fs.readFileSync(file, "utf8").trim(); if (v) { clearInterval(iv); resolve(v); } } catch {} if (Date.now() - t0 > 600000) { clearInterval(iv); resolve(""); } }, 2000); }
    else readline.createInterface({ input: process.stdin }).once("line", (l) => resolve(l.trim()));
  });
  ok(!!link, "received the emailed link");
  if (link) {
    const redir = new URL(link).searchParams.get("redirect_to") ?? "";
    ok(redir.startsWith(BASE + "/auth/callback"), `email link's redirect_to targets our /auth/callback (${redir.slice(0, 60)}…) — otherwise add it to Supabase Redirect URLs`);
    await page.goto(link, { waitUntil: "load" });
    // Streaming pages deliver redirect() as a client-side navigation after `load`, so wait for the page to SETTLE:
    // either the onboarding form (new account) or the dashboard heading (existing account).
    await Promise.race([
      page.locator("#first_name").waitFor({ timeout: 30000 }),
      page.getByRole("heading", { name: "Your Opportunities" }).waitFor({ timeout: 30000 }),
    ]).catch(() => {});
    ok(/\/(onboarding|dashboard)/.test(page.url()), `magic link completed sign-in → ${new URL(page.url()).pathname}`);

    if (page.url().includes("/onboarding")) {
      const chips = await page.locator("fieldset:has(legend:text('interested in')) label").count();
      ok(chips === 16, `onboarding shows ${chips} interest options`);
      await page.fill("#first_name", "Smoke"); await page.fill("#birth_date", "2010-03-15"); await page.selectOption("#grade", "10");
      await page.fill("#zip", "20001"); await page.selectOption("#state", "DC"); await page.fill("#school_name", "Smoke Test School");
      await page.getByText("Electrical Engineering", { exact: true }).click(); await page.getByText("Computer Science", { exact: true }).click();
      for (const t of ["Internships", "Summer programs"]) await page.getByText(t, { exact: true }).click();
      await page.getByText("Either is fine").click(); await page.getByText("Either", { exact: true }).click(); await page.getByText("50+ miles").click();
      await page.getByText("During the summer").click(); await page.locator("input[name=email_reminders]").uncheck();
      await page.getByRole("button", { name: "Show my opportunities" }).click();
      await page.waitForURL("**/dashboard**", { timeout: 20000 }).catch(() => {});
      ok(page.url().includes("/dashboard"), "onboarding submitted → dashboard");
    }
    await page.goto(BASE + "/dashboard"); await page.waitForLoadState("networkidle");
    const cards = await page.locator("article").count();
    console.log(`   dashboard shows ${cards} opportunity card(s)`);
    if (cards > 0) {
      const first = page.locator("article").first();
      ok((await first.locator("li").count()) > 0, "card lists match reasons (explainable)");
      await first.getByRole("link", { name: "View details" }).click(); await page.waitForURL("**/opportunities/**");
      ok(await page.getByText("Your eligibility").count() === 1, "detail page shows the personalized eligibility analysis");
      ok(await page.getByText("Last verified").count() >= 1 || await page.getByText("Not yet verified").count() >= 1, "detail page shows verification status/date");
      await page.getByRole("button", { name: /Save/ }).first().click(); await page.waitForTimeout(1500);
      ok(await page.getByRole("button", { name: /Saved/ }).count() > 0, "save works");
      const apply = page.getByRole("link", { name: /Apply on the official site/ });
      if (await apply.count()) {
        const r = await ctx.request.get(BASE + await apply.getAttribute("href"), { maxRedirects: 0 });
        ok(r.status() === 302 && /^https?:\/\//.test(r.headers().location ?? ""), `apply link logs a click then redirects to the official page (${(r.headers().location ?? "").slice(0, 60)})`);
      }
      await page.reload(); const sel = page.locator("select"); if (await sel.count()) { await sel.selectOption("planning"); await page.waitForTimeout(1200); await page.goto(BASE + "/saved"); await page.waitForSelector("article"); ok(await page.locator("select").first().inputValue() === "planning", "self-reported status persists on Saved"); }
    } else console.log("   (no cards: either no verified opportunities fit this test profile, or none are loaded yet)");
    const adm = await page.goto(BASE + "/admin"); ok(!page.url().includes("/admin"), "non-admin is bounced from /admin");
    void adm;
    ok(errors.length === 0, `no browser console errors / CSP violations${errors.length ? ": " + errors.slice(0, 3).join(" | ") : ""}`);
    if (process.env.SMOKE_CLEANUP === "1") {
      await page.goto(BASE + "/profile"); await page.getByRole("button", { name: "Delete my account…" }).click(); await page.getByRole("button", { name: "Yes, delete everything" }).click();
      await page.waitForURL(/deleted=1/, { timeout: 20000 }).catch(() => {});
      ok(page.url().includes("deleted=1"), "test account deleted (cleanup)");
    }
  }
  await browser.close();
}
console.log(failed ? `\nFAILED: ${failed} check(s)` : "\nALL SMOKE CHECKS PASSED");
process.exit(failed ? 1 : 0);
