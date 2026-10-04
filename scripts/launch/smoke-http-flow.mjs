// Authenticated live smoke over plain HTTP (no browser). Driven by live-smoke.mjs when CHROMIUM_PATH is not set.
// Same trust path as the public checks (Node's fetch + normal TLS verification). Exercises the REAL production code:
// magic-link sign-in (PKCE cookie held by this client), onboarding, profile edit, matching, detail, save, status,
// apply-click tracking, authorization boundaries and (optionally) deletion of the disposable account.
// Not covered here (needs a real browser): React hydration and client-side console/CSP-violation errors.
import fs from "node:fs";
import { HttpSession, alerts, pageRedirect, completeMagicLink, discoverActions, extractMagicLink, fieldValue, findForm, normalizeHtml, parseCards } from "./http-client.mjs";

const UUID_NONE = "00000000-0000-4000-8000-000000000000";
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Synthetic test student (no real person's data). Values come from the form's own options where possible. */
export function onboardingOverrides(form, now = new Date()) {
  const schoolYearEnd = now.getUTCMonth() >= 6 ? now.getUTCFullYear() + 1 : now.getUTCFullYear();
  const slugs = form.fields.filter((f) => f.name === "interests").map((f) => f.value);
  const pick = ["government_policy", "computer_science"].filter((x) => slugs.includes(x));
  return {
    first_name: "Smoke", birth_date: "2010-03-15", grade: "11", graduation_year: String(schoolYearEnd + 1),
    zip: "22030", state: "VA", school_name: "Smoke Test FCPS High School",
    interests: pick.length ? pick : slugs.slice(0, 2),
    opportunity_types: ["internship", "summer_program"].filter((t) => form.fields.some((f) => f.name === "opportunity_types" && f.value === t)),
    pay_preference: "either", work_mode_preference: "either", max_travel_miles: "50",
    available_summer: "on", available_school_year: null, email_reminders: null,
  };
}

export async function runHttpFlow({ base, email, linkFile, stateFile, cleanup, supabaseHost, hiddenOpportunityId, expectTitle, ok }) {
  const s = new HttpSession(base);
  const path = (r) => new URL(r.url ?? r.path, base).pathname;
  const save = () => { if (stateFile) fs.writeFileSync(stateFile, JSON.stringify(s.jar.toJSON()), { mode: 0o600 }); };
  const drop = () => { if (stateFile) try { fs.unlinkSync(stateFile); } catch { /* none */ } };
  let resumed = false;
  if (stateFile && fs.existsSync(stateFile)) {
    try { s.jar.load(JSON.parse(fs.readFileSync(stateFile, "utf8"))); resumed = true; } catch { /* ignore a corrupt file */ }
  }
  console.log(`\n== FULL flow over HTTP (${email.replace(/(.).+(@.+)/, "$1***$2")}); no browser`);

  let deleted = false;
  let signedIn = false;
  let staleCookie = "";
  let landed;
  let link = "";

  if (resumed) {
    // A previous run signed in but didn't finish: reuse its session (no new email) so it can still be completed and cleaned up.
    landed = await s.get("/dashboard");
    signedIn = path(landed) !== "/start";
    ok(signedIn, signedIn ? `resumed the saved session → ${path(landed)} (no new email sent)` : "saved session is no longer valid; delete the state file and run again");
    if (!signedIn) { drop(); return; }
  } else {
    // ---- 1. request the magic link through the real sign-in form (a no-JS browser posts exactly this)
    const start = await s.get("/start");
    const signIn = findForm(start.text, (f) => f.fields.some((x) => x.name === "age13"));
    ok(!!signIn, "sign-in page has the email + age-13 form");
    if (!signIn) return;
    const sent = await s.submitForm("/start", signIn, { email, age13: "on" });
    ok(/We emailed a secure sign-in link/.test(sent.text ?? ""), "sign-in form accepted the request (Supabase returned success)");
    ok(s.jar.names().some((n) => /code-verifier/.test(n)), "PKCE code-verifier cookie was set for this client");
    if (!/We emailed a secure sign-in link/.test(sent.text ?? "")) { console.log("   error shown:", alerts(sent.text ?? "")); return; }

    // ---- 2. get the emailed link (an agent/person writes it to linkFile) and complete sign-in
    console.log("WAITING_FOR_LINK — put the full magic link from the email into SMOKE_LINK_FILE");
    for (const t0 = Date.now(); !link && Date.now() - t0 < 600000; await sleep(2000)) {
      try { const raw = fs.readFileSync(linkFile, "utf8"); link = extractMagicLink(raw, supabaseHost) ?? (/^https:\/\//.test(raw.trim()) ? raw.trim() : ""); } catch { /* not there yet */ }
    }
    ok(!!link, "received the emailed link");
    if (!link) return;
    const done = await completeMagicLink(s, link, { supabaseHost });
    ok(done.ok, done.ok ? "magic link verified by Supabase and redirected to our /auth/callback" : `magic link rejected: ${done.why} (if the redirect is the bare Site URL, add /auth/callback and /** to Supabase Redirect URLs)`);
    if (!done.ok) return;
    signedIn = s.jar.names().some((n) => /^sb-.*-auth-token(\.\d+)?$/.test(n));
    ok(signedIn, "session cookie issued after callback code exchange");
    if (signedIn) save();
    landed = done.landed;
    ok(/^\/(onboarding|dashboard)$/.test(path(landed)), `magic link completed sign-in → ${path(landed)}`);
    // replaying the same one-time link must not work
    const replay = await fetch(new URL(link.trim()), { redirect: "manual" });
    const rl = replay.headers.get("location") ?? "";
    await replay.arrayBuffer();
    ok(!/[?&]code=/.test(rl), "a second use of the one-time link does not yield a new code");
  }

  try {
    let where = path(landed);
    // ---- 3. onboarding (new account) or profile (existing)
    if (where === "/onboarding") {
      const page = landed.text;
      const form = findForm(page, (f) => f.fields.some((x) => x.name === "first_name"));
      ok(!!form, "onboarding form renders");
      const chips = form.fields.filter((f) => f.name === "interests").length;
      ok(chips === 16, `onboarding shows ${chips} interest options`);
      const res = await s.submitForm("/onboarding", form, onboardingOverrides(form));
      ok(path(res) === "/dashboard", `onboarding submitted → ${res.redirectedTo ?? res.path} (POST ${res.postStatus})`);
      if (path(res) !== "/dashboard") console.log("   page said:", alerts(res.text ?? ""));
      where = path(res);
    }

    // ---- 4. matching: dashboard is deterministic and explainable
    const d1 = await s.get("/dashboard");
    const d2 = await s.get("/dashboard");
    ok(d1.status === 200 && path(d1) === "/dashboard", "dashboard loads for the signed-in student");
    const cards = parseCards(d1.text);
    console.log(`   dashboard shows ${cards.length} opportunity card(s)`);
    ok(normalizeHtml(d1.text) === normalizeHtml(d2.text), "matching is deterministic (two renders are identical)");
    ok(JSON.stringify(cards) === JSON.stringify(parseCards(d2.text)), "card order and match reasons are stable");
    const csp = d1.res.headers.get("content-security-policy") ?? "";
    const nonce = /'nonce-([^']+)'/.exec(csp)?.[1];
    const inline = [...d1.text.matchAll(/<script\b([^>]*)>/gi)].map((m) => m[1]);
    ok(!!nonce && inline.length > 0 && inline.every((a) => a.includes(`nonce="${nonce}"`) || /\bsrc=/.test(a) && a.includes(`nonce="${nonce}"`)), "every script tag on the dashboard carries this response's CSP nonce");
    if (expectTitle) ok(cards.some((c) => c.title.includes(expectTitle)), `dashboard lists the verified opportunity "${expectTitle}"`);
    for (const [i, c] of cards.entries()) if (i < 3) ok(c.id && c.reasons.length > 0, `card "${c.title.slice(0, 40)}" lists match reasons (explainable)`);

    // ---- 5. detail, save, status, apply tracking on the first card (skipped honestly if nothing matches)
    const first = (expectTitle && cards.find((c) => c.title.includes(expectTitle))) || cards[0];
    let actions = {};
    if (first?.id) {
      const detail = await s.get(`/opportunities/${first.id}`);
      ok(detail.status === 200 && /Your eligibility/.test(detail.text), "detail page shows the personalized eligibility analysis");
      ok(/Last verified|Not yet verified/.test(detail.text), "detail page shows verification status/date");
      actions = await discoverActions(s, `/opportunities/${first.id}`, detail.text);
      ok(["toggleSave", "setApplicationStatus", "submitFeedback"].every((n) => actions[n]), "client actions discovered from the page's own scripts");

      const call = (name, ...args) => s.callAction(`/opportunities/${first.id}`, actions[name], args);
      const saved = await call("toggleSave", first.id, true);
      ok(saved.value?.ok === true, "save works");
      const savedPage = await s.get("/saved");
      ok(savedPage.text.includes(first.id), "saved opportunity appears on /saved");
      const st = await call("setApplicationStatus", first.id, "planning");
      ok(st.value?.ok === true, "self-reported status update works");
      const savedPage2 = await s.get("/saved");
      ok(new RegExp(`<option[^>]*value="planning"[^>]*selected`).test(savedPage2.text) || /<option[^>]*selected=""[^>]*value="planning"/.test(savedPage2.text), "self-reported status persists on Saved");

      const fb = await call("submitFeedback", first.id, "topic");
      ok(fb.value?.ok === true, "\"Not a good match?\" feedback is accepted (allow-listed reason)");

      const go = await s.request(`/go/${first.id}`);
      const loc = go.headers.get("location") ?? "";
      await go.arrayBuffer();
      ok(go.status === 302 && /^https?:\/\//.test(loc), `apply link logs a click then redirects to the official page (${loc.slice(0, 60)}); not followed`);

      // ---- authorization / validation boundaries on the action endpoints
      ok((await call("setApplicationStatus", first.id, "hacked")).value?.ok === false, "invalid status value is rejected");
      ok((await call("setApplicationStatus", UUID_NONE, "planning")).value?.ok === false, "status for an opportunity that isn't saved/doesn't exist is rejected");
      ok((await call("toggleSave", UUID_NONE, true)).value?.ok === false, "saving a nonexistent opportunity is rejected");
      ok((await call("submitFeedback", first.id, "free text injection")).value?.ok === false, "feedback only accepts allow-listed reasons");
      const anon = new HttpSession(base);
      const anonSave = await anon.callAction(`/opportunities/${first.id}`, actions.toggleSave, [first.id, true]);
      ok(anonSave.value?.ok !== true && !/"ok":true/.test(anonSave.text), "a signed-out caller cannot save (the proxy bounces it to /start or the action answers ok:false; auth comes from the cookie)");
      ok((await call("toggleSave", first.id, false)).value?.ok === true, "unsave works");
      ok((await call("setApplicationStatus", first.id, "planning")).value?.ok === false, "status can't be set on an unsaved opportunity");
    } else console.log("   (no cards: either no verified opportunities fit this test profile, or none are loaded yet)");

    // ---- 6. other authorization boundaries
    for (const p of ["/admin", "/admin/analytics", "/admin/import", "/admin/opportunities/new", `/admin/opportunities/${UUID_NONE}`]) {
      const r = await s.get(p);
      ok(path(r) === "/dashboard" && !/Import|Analytics|Verify/.test((/<h1[^>]*>([\s\S]*?)<\/h1>/.exec(r.text) ?? [])[1] ?? ""), `non-admin ${p} → bounced to /dashboard`);
    }
    const missing = await s.get(`/opportunities/${UUID_NONE}`);
    ok(missing.status === 404 || path(missing) !== `/opportunities/${UUID_NONE}`, "unknown opportunity id is not served");
    const goMissing = await s.request(`/go/${UUID_NONE}`);
    await goMissing.arrayBuffer();
    const gl = goMissing.headers.get("location") ?? "";
    ok(goMissing.status >= 300 && goMissing.status < 400 && new URL(gl, base).origin === new URL(base).origin, "/go/<unknown id> stays on our site (no open redirect)");
    if (hiddenOpportunityId) {
      const hidden = await s.get(`/opportunities/${hiddenOpportunityId}`);
      ok(hidden.status === 404 || !/Your eligibility/.test(hidden.text), "an unverified draft is invisible to students (detail page)");
      const goHidden = await s.request(`/go/${hiddenOpportunityId}`);
      await goHidden.arrayBuffer();
      ok(new URL(goHidden.headers.get("location") ?? "/", base).origin === new URL(base).origin, "an unverified draft's apply link is not served to students");
      ok(!d1.text.includes(hiddenOpportunityId), "an unverified draft is not on the dashboard");
    }

    // ---- 7. profile edit persists
    const prof = await s.get("/profile");
    ok(path(prof) === "/profile", `profile page opens for a signed-in student (${path(prof)})`);
    const pform = path(prof) === "/profile" ? findForm(prof.text, (f) => f.fields.some((x) => x.name === "school_name")) : undefined;
    ok(!!pform, "profile form loads with saved values");
    if (pform) {
      ok(fieldValue(pform, "first_name")[0] === "Smoke" && fieldValue(pform, "zip")[0] === "22030", "profile shows what onboarding saved");
      const res = await s.submitForm("/profile", pform, { school_name: "Smoke Test FCPS High School Two" });
      ok(path(res) === "/dashboard", `profile saved → ${path(res)} (POST ${res.postStatus})`);
      if (path(res) !== "/dashboard") console.log("   page said:", alerts(res.text ?? ""));
      const again = findForm((await s.get("/profile")).text, (f) => f.fields.some((x) => x.name === "school_name"));
      ok(fieldValue(again, "school_name")[0] === "Smoke Test FCPS High School Two", "profile edit persisted");

      // ---- 7b. optional Match details: absent by default, savable, matching still renders, and fully removable
      ok(/Match details/.test(prof.text) && /never shared with the programs/.test(prof.text), "profile offers optional Match details with the not-shared notice");
      ok(["gpa_value", "attest_financial_need", "attest_citizenship", "college_plan"].every((n) => fieldValue(again, n).filter(Boolean).length === 0), "Match details start empty (nothing was required at onboarding)");
      const details = { gpa_value: "3.4", gpa_scale: "4.0", gpa_weighting: "unweighted", attest_financial_need: "prefer_not", attest_citizenship: "yes", college_plan: "four_year" };
      const withDetails = await s.submitForm("/profile", again, details);
      ok(path(withDetails) === "/dashboard", `profile with Match details saved → ${path(withDetails)}`);
      const filled = findForm((await s.get("/profile")).text, (f) => f.fields.some((x) => x.name === "school_name"));
      ok(Object.entries(details).every(([k, v]) => fieldValue(filled, k)[0] === v), "Match details persisted exactly as entered");
      const dashWith = await s.get("/dashboard");
      ok(path(dashWith) === "/dashboard" && /Strong|Likely|Eligible|Check Requirement/.test(dashWith.text), "dashboard still matches with Match details set");
      const badGpa = await s.submitForm("/profile", filled, { gpa_value: "4.9", gpa_scale: "4.0", gpa_weighting: "weighted" });
      ok(path(badGpa) !== "/dashboard", "an out-of-range GPA is rejected, not saved");
      const cleared = await s.submitForm("/profile", filled, { gpa_value: "", gpa_scale: "", gpa_weighting: null, attest_financial_need: "", attest_citizenship: "", college_plan: "" });
      ok(path(cleared) === "/dashboard", `clearing Match details saved → ${path(cleared)}`);
      const after = findForm((await s.get("/profile")).text, (f) => f.fields.some((x) => x.name === "school_name"));
      ok(["gpa_value", "gpa_scale", "gpa_weighting", "attest_financial_need", "attest_citizenship", "college_plan"].every((n) => fieldValue(after, n).filter(Boolean).length === 0), "Match details were fully removed");
    }
  } finally {
    // ---- 8. cleanup: delete only the disposable account. Runs even if an earlier step threw, so a failed run can't strand it.
    if (cleanup && signedIn) {
      try {
        const prof2 = await s.get("/profile");
        const acts = await discoverActions(s, "/profile", prof2.text);
        if (path(prof2) !== "/profile" || !acts.deleteAccount) throw new Error(`profile page not available for deletion (landed on ${path(prof2)})`);
        staleCookie = s.jar.header();
        const del = await s.callAction("/profile", acts.deleteAccount, []);
        deleted = /deleted=1/.test(del.redirect ?? "");
        ok(deleted, `test account deleted (cleanup) → ${del.redirect ?? del.status}`);
      } catch (e) {
        ok(false, `cleanup failed: ${e.message}`);
      }
      if (deleted) drop();
      else console.log(`   NOTE: the disposable account still exists.${stateFile ? ` Its session is saved in SMOKE_STATE_FILE; re-run with the same file to resume and clean up (no new email).` : ""} Otherwise delete it manually (sign in → Profile → Delete my account).`);
    }
  }
  if (deleted) {
    const after = await s.get("/dashboard");
    ok(path(after) === "/start", "after deletion the dashboard redirects to /start (cookies cleared)");
    const stale = await fetch(new URL("/dashboard", base), { redirect: "manual", headers: { cookie: staleCookie } });
    // Streamed pages answer 200 + a meta refresh instead of a 3xx; both mean "sent to /start".
    const staleLoc = stale.headers.get("location") ?? pageRedirect(await stale.text()) ?? "";
    ok(/\/start/.test(staleLoc), "the deleted account's old session cookie no longer opens the dashboard");
  }
}
