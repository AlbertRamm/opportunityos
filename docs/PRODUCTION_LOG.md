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
