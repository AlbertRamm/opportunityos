# Launch runbook (run by a session/person with live access)

Every step has a script that was tested against local stand-ins (real Postgres, real browser, mock Supabase Auth, local SMTP sink).
**What was NOT possible from the build sandbox:** its egress policy blocked the live site, Supabase, Vercel, Gmail SMTP and every official-source site, and it had no credentials. Nothing below has been run against production yet.

## 0. Access required
| Need | For |
|---|---|
| Network allow-list: `opportunityos-ochre.vercel.app`, `jtgxmhrhebnjufttnxkn.supabase.co`, `vercel.com` + `api.vercel.com`, `smtp.gmail.com`, and the official domains you will cite (e.g. `si.edu`, `nih.gov`, `nist.gov`, `loc.gov`, `dc.gov`, `gmu.edu`, county `*.k12.*`/`*.gov`) | all steps |
| `SUPABASE_DB_URL` (Supabase → Settings → Database → connection string) | steps 1–2 |
| `VERCEL_TOKEN` (or `vercel login`) | step 2 |
| `SMTP_PASS` = the sender account's Gmail **app password** (already created) | step 2 |
| `SUPABASE_ANON_KEY` (public key) | step 3 |
| A mailbox you can read for tests (e.g. the sender account itself, or a `+smoke` alias) | steps 2–3, 5 |
Export secrets with `read -rs VAR && export VAR` so they never hit shell history or argv.

## 1. Apply the migrations and verify
```bash
./scripts/launch/apply-migrations.sh        # applies 20261003… then 20261004…, then runs supabase/launch/verify_launch_schema.sql
```
Expect `✓ schema verified` (50 checks: tables, RLS, policies, functions, grants, 16 interests). Same verifier can be pasted into the SQL editor.

## 2. Reminders: Vercel env + hash + redeploy + idempotency + delivery
```bash
export TEST_MAILBOX=you@readable.mailbox
./scripts/launch/setup-reminders.sh
```
Sets `CRON_SECRET`, `SMTP_*`, `EMAIL_FROM` in Vercel production (stdin only), stores only the secret's SHA-256 in Supabase, redeploys, checks 401 without auth, runs the cron twice (second must claim 0), and sends one SMTP test mail. Confirm the test mail arrived in `TEST_MAILBOX`.
For a *real* due-reminder test, use the dedicated smoke account: save an opportunity whose deadline is within 7 days, then call the endpoint (verify exactly one email, and none on a second call).

## 3. Magic-link delivery
```bash
export SUPABASE_URL=https://jtgxmhrhebnjufttnxkn.supabase.co; read -rs SUPABASE_ANON_KEY; export SUPABASE_ANON_KEY
TEST_EMAIL=you@readable.mailbox ./scripts/launch/diagnose-auth-email.sh
```
Supabase sends synchronously, so the HTTP status names the failure class (429 rate limit → Auth → Rate Limits; 5xx → SMTP settings; 200 → handed to SMTP). Then read Supabase → Logs → Auth, open the received email, and verify the link's `redirect_to` is `https://opportunityos-ochre.vercel.app/auth/callback?...`. If it is the bare Site URL, add `https://opportunityos-ochre.vercel.app/auth/callback` and `/**` to Auth → URL Configuration → Redirect URLs. Open the link in the **same browser** that requested it: it must land on `/onboarding` or `/dashboard`.

## 4. Real data (official first-party sources only)
Qualifying opportunity = (a) published by the organization that runs it (program page, application portal, official PDF); (b) open now or with an officially announced upcoming window; (c) high-school students eligible; (d) in DC/MD/Northern VA, or open to residents there. No aggregators, no blogs, no snippets. Fewer, fully verified records beats filler; report the shortfall against 30.
```bash
npm i                                                              # installs tsx
npm run launch:fetch -- https://<official page or PDF>              # one per source → data/snapshots/*.json (dated, hashed)
# JS-only page? open in a browser, copy the visible text into a snapshot JSON of the same shape (url, fetched_at, status, sha256, text).
# Write batch.json following docs/opportunity-batch.template.json: every decision field needs an `evidence` quote copied from the page.
npm run launch:check-batch -- batch.json                            # must be 100% ✓: validates, quotes appear VERBATIM in fresh snapshots, no unsupported fields
```
Then Admin → Import from URL → paste batch → **Validate (dry run)** → **Create drafts**. For **every** draft: open it, compare each field and quote to the live page, tick "I compared…", **Save & verify**. Leave unsupported/unclear fields blank or in *Other requirements*; do not verify a record you could not fully support. Archive `data/snapshots` privately as the audit trail.
When the verified real set is loaded: run `supabase/remove-samples.sql` (Supabase SQL editor).

## 5. Live end-to-end + admin protection
```bash
BASE_URL=https://opportunityos-ochre.vercel.app npm run launch:smoke                       # public: headers, CSP, redirects, cron auth, forged tokens
# full flow with a real magic link, HTTP-driven (default; no browser, Node fetch + normal TLS verification):
BASE_URL=https://opportunityos-ochre.vercel.app SMOKE_EMAIL=you+smoke@gmail.com SMOKE_LINK_FILE=/tmp/link.txt SMOKE_CLEANUP=1 SUPABASE_URL=https://<ref>.supabase.co npm run launch:smoke
# …when the script prints WAITING_FOR_LINK, read the ONE sign-in email and write its link into /tmp/link.txt. The link is single-use
#   and only completes in the process that requested it (it holds the PKCE cookie), so keep that process running.
# Optional: SMOKE_HIDDEN_OPPORTUNITY_ID=<uuid of an unverified draft> asserts students can't see it.
# Browser mode (also catches hydration/CSP console errors): add CHROMIUM_PATH=/path/to/chrome and `npm i -g playwright-core`.
Then, signed in as the admin: `/admin`, `/admin/analytics` load; a non-admin gets bounced.

## 6. If the CSP breaks something in production
Set `CSP_MODE=report-only` (or `off`) in Vercel and redeploy; fix `src/lib/csp.ts` afterwards.
