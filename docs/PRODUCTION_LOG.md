# Production change log

Append-only record of changes made to the live OpportunityOS project. Never put secrets here.

## 2026-10-03: migration 20261005 applied (reminders skip sample listings)
- **What:** `supabase/migrations/20261005000000_reminders_skip_samples.sql` (one idempotent `CREATE OR REPLACE FUNCTION public.claim_due_reminders`, adds `and not o.is_sample`). No data touched.
- **How:** Supabase Management API `POST /v1/projects/<ref>/database/query` with only that file's SQL. Applied outside `supabase_migrations` history (earlier migrations were also applied by hand; history table is empty), so it is not recorded there.
- **Verified after:** `skips_samples=true`, `anon_can_claim=true`, `anon_can_call_cron_ok=false`; `supabase/launch/verify_launch_schema.sql` = **51/51 checks passed** (before: 1 failing, the 20261005 check).
- **Not done (by instruction):** no older migration re-run, no secret rotation, no `setup-reminders.sh`, no `remove-samples.sql`, no deletes.
- **Live checks:** `GET /api/cron/reminders` returns 401 with no auth and with a wrong bearer token; the production alias serves 200 with a nonce CSP.

## Known credential issue (recorded once)
- The Vercel API token available to the agent is rejected (`403 invalidToken`) on every `api.vercel.com` call. Deployment health is checked by hitting the live URL instead. Re-issue the token if API access is needed.

## 2026-10-04: first real draft imported
- Batch `2026-10-dmv-batch-1`: 1 record, **Fairfax County Youth Leadership Program (FCYLP)**, inserted as `verification_status='unverified'` (invisible to students) with its `opportunity_admin` evidence row. Passed `launch:check-batch` (1/1) before import.
- Inserted via the database API replicating `importBatch` (admin UI login was unavailable); `created_by` is null for that reason. The audit trigger recorded the insert.
- **Awaiting human verification:** an admin must open the draft, compare against https://www.fairfaxcounty.gov/budget/youth-leadership, and Save & verify.

## 2026-10-04: credential repair re-test (read-only; no production changes)
- **Vercel API:** token now works (`GET /v9/projects`, `/v6/deployments` return 200; `/v2/user` is 404 because the token is team-scoped, not an error). Latest production deployment `fb9c13e` is READY. The earlier `403 invalidToken` note above is resolved.
- **Reminder endpoint:** authorized `GET /api/cron/reminders` run twice -> `{"claimed":0,"sent":0,"failed":0}` both times (empty and idempotent). Anonymous and wrong-bearer calls return 401 when made without the proxy (live-smoke public section: 23/23 checks passed). Note: from the agent container the egress proxy injects the cron bearer on every request to this host, so curl-based "anonymous" checks there return 200; that is the proxy, not an auth hole.
- **Local gates:** `npm run lint` clean; `npm test` 85/85; `npm run build` OK; `npm run typecheck` clean after a build (it needs the generated `PageProps`/`LayoutProps` types, so run it after `next build` or `next typegen`).
- **Not done (external blocker):** authenticated full smoke (`SMOKE_EMAIL=...+oosmoke`). Chromium in the agent container rejects the egress proxy's TLS CA (`ERR_CERT_AUTHORITY_INVALID`) and trusting that CA was not permitted, so no magic-link email was sent and no smoke account exists. Run the full smoke from a machine with normal TLS, or have the container's browser trust store configured.
- FCYLP draft left `unverified` as instructed; no source sites were bypassed.

## 2026-10-04: authenticated smoke attempt #1 (HTTP mode) and an orphaned test account
- One magic-link email was sent to the dedicated smoke mailbox (`...+oosmoke@...`) and consumed; sign-in, PKCE exchange, one-time-link replay refusal, dashboard determinism, CSP nonces, non-admin bounces and unknown-id handling passed.
- The run then hit two harness gaps (not product bugs): (1) streamed pages (`loading.tsx`) deliver `redirect()` as a 200 + `__next-page-redirect` meta refresh, which the new HTTP client didn't follow, so a brand-new account stayed on `/dashboard` instead of `/onboarding`; (2) because onboarding never ran, `/profile` bounced to `/onboarding`, the delete-account button was never found, and cleanup failed. The client now follows the meta refresh and cleanup runs in `finally`.
- **Open item:** the disposable account for that mailbox still exists (auth user only, no profile row; no student data). Its session was held only in the exited process. It is deleted by the next successful `SMOKE_CLEANUP=1` run (sign in -> Profile -> Delete) or manually.

## 2026-10-04: authenticated smoke attempt #2 (HTTP mode) - incomplete
- Second authorized magic-link email sent and consumed. Sign-in, `/onboarding` landing (streamed-redirect fix confirmed), 16 interest options, replay refusal and CSP nonces passed.
- **Onboarding POST did not reach `/dashboard`** (cause not captured: the run didn't log the POST status or validation messages). Because the account then had no profile, `/profile` bounced to `/onboarding` and cleanup couldn't find the delete button; the run ended and its in-memory session was lost.
- **Open item:** the disposable account for the smoke mailbox still exists (auth user only, no profile row). Harness now logs POST status + `role=alert` messages and persists the session to `SMOKE_STATE_FILE` so a failed run can be resumed/cleaned without another email.
- Not established: whether the onboarding failure is a harness form-encoding issue or a product bug. Do not call it either until the next run prints the page's messages.

## 2026-10-04: authenticated smoke attempt #3 (HTTP mode, persisted session) - onboarding fails on PRODUCTION
- Third authorized magic-link email sent and consumed; session persisted in `SMOKE_STATE_FILE`, and a resumed re-run confirmed resume works with no email.
- **Finding:** submitting the onboarding form (valid payload, proven against the real `ProfileForm` markup in `scripts/launch/onboarding-form.test.mjs`) returns HTTP 200 with *"We couldn't save your profile. Please try again."* every time (two attempts). That message is the `profiles` upsert-failure branch of `saveProfile` (`src/app/onboarding/actions.ts`), i.e. validation passed and the database write failed. It is reproducible, so a real student in a browser very likely hits it too: **treat onboarding as broken in production until proven otherwise.**
- **Ruled out:** schema drift (live `profiles` columns, 11 constraints and the single `profiles_updated` trigger match the migrations; `email_reminders` exists), wrong field names/values, invalid payload.
- **Not yet known:** the actual PostgREST/Postgres error. Vercel runtime logs could not be streamed through the agent proxy (`upstream request failed`), Supabase log tables are not exposed to the Management API token, the token lacks `api_gateway_keys_read`, and a rolled-back replay of the upsert as the smoke user was refused by the sandbox (production write). Next step: read the `[profile] upsert failed <message>` line in Vercel -> Logs (Functions, POST /onboarding) or run the replay in the Supabase SQL editor.
- **Open items:** the disposable smoke account (auth user only, no profile row) still exists. It cannot be deleted through the UI: `/profile` redirects to `/onboarding` until a profile exists, so a signed-in user who cannot finish onboarding also cannot delete their account. Product gap worth fixing separately.
