# OpportunityOS (V0)

Helps high-school students in DC / Maryland / Northern Virginia answer: **"What opportunities am I actually eligible for right now?"**

Stack: Next.js 16 (App Router) · TypeScript · Tailwind 4 · Supabase (Postgres + Auth) · Vercel. Dependencies: `@supabase/supabase-js`, `@supabase/ssr`, `zod`, `server-only` (+ `vitest` for tests).

How it works, in one paragraph: humans enter and **verify** structured opportunities in `/admin`; students create a profile; a **pure, deterministic TypeScript engine** (`src/lib/matching`) compares profile vs. verified requirements and returns Strong Match / Eligible / Check Requirement / Not Eligible plus a reason for every check. No LLM is involved in eligibility. Read [`docs/DESIGN.md`](docs/DESIGN.md) for the rules and edge cases.

---

## 1. Run locally

Prereqs: Node 20.19+ (tested on 22), a free Supabase project (section 2).

```bash
cd opportunityos
npm install
cp .env.example .env.local      # fill in the two Supabase values (section 3)
npm run dev                     # http://localhost:3000
```

Checks: `npm run lint`, `npm run typecheck`, `npm test` (matching engine), `npm run check` (all three), `npm run build`.

## 2. Supabase setup (one time, ~10 minutes)

1. **Create a project** at supabase.com → New project. Save the DB password somewhere safe.
2. **Run the schema:** Dashboard → SQL Editor → New query → paste the entire contents of `supabase/migrations/20261002000000_init.sql` → Run.
3. **Load sample data (dev/staging only):** paste `supabase/seed.sql` → Run. These are 10 *fictional* opportunities, badged "Sample data" in the UI.
4. **Auth settings** (Authentication → …):
   - *Sign In / Providers → Email:* enable. Students sign in with an emailed one-time code (no passwords), so leave "Confirm email" on.
   - *Email Templates → Magic Link:* the app asks students to type a 6-digit code, so the template **must include `{{ .Token }}`**. Replace the body with e.g.
     `<p>Your OpportunityOS code is <strong>{{ .Token }}</strong>. It expires in an hour. If you didn't ask for this, ignore this email.</p>`
     Do the same for the *Confirm signup* template (new users get that one).
   - *URL Configuration:* set Site URL to your deployed URL (and `http://localhost:3000` as an additional redirect for dev).
   - **Before real students use it: configure custom SMTP** (Project Settings → Auth → SMTP; e.g. Resend/Postmark). Supabase's built-in email sender is limited to a handful of emails **per hour for the whole project** and will block sign-ups.
5. **API keys:** Project Settings → API → copy the **Project URL** and the **anon / publishable key**. Do **not** use the `service_role` key anywhere in this app — it isn't needed.
6. **Make yourself admin:** sign in to the app once, then run `supabase/make-admin.sql` (edit the email first) in the SQL editor. Then `/admin` works for that account. Admins are never created through the app.

### Migrations
There is one migration file, applied by pasting it into the SQL editor (or `supabase db push` if you adopt the Supabase CLI later). For future changes, add a new timestamped file in `supabase/migrations/` — never edit an applied one. `supabase/tests/` + `npm run db:test` apply the schema, seed, and RLS tests to a **scratch** Postgres (`DATABASE_URL=postgres://… npm run db:test`); it never touches Supabase.

## 3. Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | local + Vercel | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local + Vercel | anon/publishable key (public by design; RLS protects data) |
| `NEXT_PUBLIC_SITE_URL` | Vercel | public site URL (metadata) |
| `REVERIFY_AFTER_DAYS` | optional, default 30 | listings older than this are flagged stale |

There is intentionally **no** service-role key variable.

## 4. Deploy to Vercel

1. Push this repo to GitHub. The app lives in the `opportunityos/` folder.
2. vercel.com → Add New → Project → import the repo → **Root Directory: `opportunityos`** (Framework: Next.js is auto-detected).
3. Add the environment variables above (Production + Preview).
4. Deploy. Then in Supabase → Authentication → URL Configuration, set the Site URL to the Vercel URL.
5. Smoke test: sign in with your email → onboarding → dashboard → `/admin` (after step 2.6).

## 5. Go-live checklist (data)
1. Run `supabase/remove-samples.sql`.
2. Enter real opportunities at `/admin/opportunities/new`: copy requirements **only** from the official page, put the page in *Source URL*, leave a field blank if the page doesn't state it, put anything you can't encode in *Other requirements*, then **Save & verify**.
3. Re-check listings regularly: Admin → "Needs re-verification" → "Re-checked: nothing changed".

## 6. What's where
```
src/lib/matching/     engine + 50+ unit tests (the product's core)
src/lib/dates.ts      date math (America/New_York "today", age, deadlines)
src/lib/extraction/   AI-extraction interface (V0: intentionally returns "not configured")
src/app/(student)/    dashboard, opportunity detail, saved, profile
src/app/(admin)/      opportunities CRUD, verify/archive, import, analytics
src/app/go/[id]       logs an application-link click, then redirects to the official page
supabase/             migration, seed, admin SQL, RLS tests
```

## 7. Known limitations (honest list)
- **Eligibility is only as good as the data.** Unknown ≠ eligible: missing info yields "Check Requirement", but a wrong verified record yields a wrong answer. Manual verification discipline matters more than any code.
- **Citizenship and GPA are not collected**, so any opportunity stating them is always "Check Requirement". **County rules can't be auto-checked** (we collect ZIP only) unless the ZIP is explicitly listed.
- **Grade is evaluated as of today**; a program for "rising seniors" must be entered as the grade a student is in *at application time*. Age may be evaluated as of a stated date, or flagged unknown if it would change before the program starts.
- **Distance is straight-line** from the ZIP centroid, via the free zippopotam.us API. If that lookup fails, distance is "unknown" (never blocks anything). The same lookup cross-checks ZIP vs. state at onboarding when available.
- **Import from URL is a stub.** It pre-fills the source URL and nothing else; there is no extraction.
- **No notifications**, no counselor/org accounts, no Spanish, one region.
- **Analytics are first-party and simple.** Anonymous landing views can be inflated by anyone (no rate limiting). "Registered" = verified an email. Events are inserted by the student's own session, so a technical student could spoof their own events.
- **Under-13 protection is an attestation checkbox**, not verification. No parental-consent flow. Get legal/school-policy advice before partnering with schools.
- Supabase's default email sender is rate-limited; see 2.4.
- Tested here against real Postgres 16 (migration, seed, RLS) and a real browser, but with a local stand-in for Supabase Auth — do the section 4.5 smoke test on your real project.

## 8. Next three highest-value improvements
1. **Load 30–50 real, verified DMV opportunities and recruit ~20 students.** Everything else is secondary until matches are real; the whole hypothesis lives or dies on data quality and relevance.
2. **Deadline reminder emails** (one email per saved opportunity at 7 days and 2 days out). It's the strongest "return later" driver and the data model already supports it.
3. **A "Not a good match?" feedback button on each card** (reason picklist). It gives you labeled data on relevance and on wrong eligibility calls, which is the metric you can't get from clicks.
