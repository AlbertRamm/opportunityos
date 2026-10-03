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
   - *Sign In / Providers → Email:* enable. Students sign in with an emailed **magic link** (no passwords); leave "Confirm email" on. The default Magic Link / Confirm signup templates work as-is as long as they contain `{{ .ConfirmationURL }}`.
   - *URL Configuration:* set Site URL to your deployed URL and add `https://YOUR-DOMAIN/auth/callback` (and `http://localhost:3000/auth/callback` for dev) to **Redirect URLs**. The app passes `emailRedirectTo=NEXT_PUBLIC_SITE_URL/auth/callback`; if it isn't allow-listed, Supabase silently falls back to the Site URL and sign-in won't complete.
   - **Before real students use it: configure custom SMTP** (Project Settings → Auth → SMTP; e.g. Resend/Postmark, or Gmail with an app password). Supabase's built-in email sender is limited to a handful of emails **per hour for the whole project** and will block sign-ups.
5. **API keys:** Project Settings → API → copy the **Project URL** and the **anon / publishable key**. Do **not** use the `service_role` key anywhere in this app — it isn't needed.
6. **Make yourself admin:** sign in to the app once, then run `supabase/make-admin.sql` (edit the email first) in the SQL editor. Then `/admin` works for that account. Admins are never created through the app.

### Migrations
Migrations are applied in filename order by pasting each into the SQL editor (or `supabase db push` if you adopt the Supabase CLI later). For future changes, add a new timestamped file in `supabase/migrations/` — never edit an applied one. `supabase/tests/` + `npm run db:test` apply the schema, seed, and RLS tests to a **scratch** Postgres (`DATABASE_URL=postgres://… npm run db:test`); it never touches Supabase.

**Run in order: `20261002000000_init.sql`, `20261003000000_ensure_interests.sql`, `20261004000000_provenance_feedback_reminders.sql`** (the last two are idempotent — safe to re-run).

`20261003…` repairs the interests table. It is idempotent and repairs the interests table (rows, read access, RLS policy). The app also falls back to a built-in interest list (`src/lib/interests.ts`) and logs `[interests] …` to the server logs if the table is empty or unreadable, so onboarding can't render a blank interests section.

`20261004…` adds: admin-only source evidence + change audit log, "Not a good match?" feedback (with privacy-thresholded admin aggregates), and the deadline-reminder tables/functions.

## 3. Environment variables

| Variable | Where | Purpose |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | local + Vercel | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | local + Vercel | anon/publishable key (public by design; RLS protects data) |
| `NEXT_PUBLIC_SITE_URL` | Vercel | public site URL (metadata) |
| `REVERIFY_AFTER_DAYS` | optional, default 30 | listings older than this are flagged stale |
| `CRON_SECRET` | Vercel (reminders) | 32+ random chars. Vercel Cron sends it as `Authorization: Bearer …`; also the shared secret the database checks |
| `SMTP_HOST` `SMTP_PORT` `SMTP_USER` `SMTP_PASS` | Vercel (reminders) | outgoing mail for reminder emails (Gmail: `smtp.gmail.com`, `465`, the Gmail address, an **app password**) |
| `EMAIL_FROM` | Vercel (reminders) | e.g. `OpportunityOS <opportunityos.team@gmail.com>` |
| `UNSUBSCRIBE_SECRET` | optional | signs unsubscribe links; defaults to `CRON_SECRET` |
| `CSP_MODE` | optional | `enforce` (default), `report-only`, or `off` — emergency switch for the Content-Security-Policy |

There is intentionally **no** service-role key variable. Reminders use the anon key plus `CRON_SECRET`; the database only releases data to a caller that proves it knows the secret. If the `SMTP_*`/`CRON_SECRET` variables are missing, the reminder job refuses to run and claims nothing.

## 4. Deploy to Vercel

1. Push this repo to GitHub. The app lives in the `opportunityos/` folder.
2. vercel.com → Add New → Project → import the repo → **Root Directory: `opportunityos`** (Framework: Next.js is auto-detected).
3. Add the environment variables above (Production + Preview).
4. Deploy. Then in Supabase → Authentication → URL Configuration, set the Site URL to the Vercel URL.
5. Smoke test: sign in with your email → onboarding → dashboard → `/admin` (after step 2.6).

### Turn on deadline reminders (one time)
1. Generate a secret: `openssl rand -hex 32`. Add it in Vercel as `CRON_SECRET`, plus the `SMTP_*` and `EMAIL_FROM` variables above (Production). Redeploy.
2. Store the secret's **hash** in the database (so the plain secret never sits in SQL history). On your machine: `printf %s "$CRON_SECRET" | sha256sum | cut -d' ' -f1`, then in the Supabase SQL editor:
   `insert into public.cron_secret (id, secret_hash) values (1, 'PASTE_HASH') on conflict (id) do update set secret_hash = excluded.secret_hash;`
3. `vercel.json` schedules `GET /api/cron/reminders` daily at 13:00 UTC (9am ET in summer, 8am in winter). Vercel runs crons on **production** deployments only.
4. Test without waiting: `curl -H "Authorization: Bearer $CRON_SECRET" https://YOUR-DOMAIN/api/cron/reminders` → `{"claimed":N,"sent":N,"failed":0}`.

Rules (enforced in SQL and covered by `npm run db:test`): 7-day and 2-day emails only for **saved**, **verified**, **non-archived** listings with a **future deadline**; never if the student marked Applied/Interview/Accepted/Not selected/No longer interested; never if they opted out; not the 7-day mail if they saved it after that window opened; one email per student × opportunity × kind × deadline (a duplicate run sends nothing); failed sends retry up to 3 times. Students opt out in Profile or with the one-click link in every email.

### If sign-in emails don't arrive (Supabase → custom SMTP)
1. Supabase → Logs → **Auth**: look for the `/otp` request and an "error sending magic link email". No request at all = the app isn't reaching this project (check `NEXT_PUBLIC_SUPABASE_URL`). An SMTP error message names the cause.
2. SMTP settings: sender email must be the **same Gmail account** as the SMTP username; password is the 16-character **app password** (no spaces), not the account password; host `smtp.gmail.com`, port `465`.
3. Authentication → **Rate Limits**: raise "emails per hour" if you set 30 and are testing a lot.
4. Check Spam/Promotions. Test from Supabase directly: Authentication → Users → *Send magic link* to a mailbox you can read.
5. Confirm `https://YOUR-DOMAIN/auth/callback` is in Redirect URLs (section 2.4).

## 5. Go-live checklist (data)
1. Run `supabase/remove-samples.sql`.
2. Load real opportunities with the evidence-first import workflow in **`docs/DATA_ENTRY.md`** (Admin → Import from URL → paste a reviewed JSON batch → drafts → verify each against its source), or by hand at `/admin/opportunities/new`. Rules: copy requirements **only** from the official page, put the page in *Source URL*, leave a field blank if the page doesn't state it, put anything you can't encode in *Other requirements*, then **Save & verify**.
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
- Reminder emails need your own SMTP credentials in Vercel; Gmail has daily send limits (fine for hundreds of students, not thousands).
- The "Not a good match?" answers hide a card for that student only; they do **not** personalize ranking (we don't claim they do).
- A nonce-based Content-Security-Policy is set by `src/proxy.ts` (every page is dynamic so each response gets a fresh nonce; the browser only ever talks to our own origin). If it ever breaks something in production, set the env var `CSP_MODE=report-only` (or `off`) and redeploy as a stop-gap, then fix the policy in `src/lib/csp.ts`. Vercel preview deployments inject their own toolbar script, which the policy blocks (harmless console noise).
- Tested here against real Postgres 16 (migration, seed, RLS) and a real browser, but with a local stand-in for Supabase Auth — do the section 4.5 smoke test on your real project.

## 8. Next three highest-value improvements
1. **Load 30–50 real, verified DMV opportunities** (docs/DATA_ENTRY.md) and then recruit ~20 students (docs/RECRUITING.md). Nothing else matters until matches are real.
2. **Read the feedback + analytics weekly and fix the data first**: "eligibility looks wrong" and "info outdated" answers point at specific listings to re-verify; "not my interest" counts tell you which topics to add.
3. **Counselor distribution**: a printable one-page flyer + a school-specific link/QR (no student data shared) so each counselor's reach can be measured without exposing any student.
