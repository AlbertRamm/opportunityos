# Admin grant + first real verification: the exact sequence

**Executed 2026-10-04** after the account owner confirmed at action time (results in `docs/PRODUCTION_LOG.md`). Kept as the reusable procedure for any future admin grant: step 2 always needs the owner's confirmation first.

## What "admin" means here
`supabase/admin/grant-admin.sql` inserts one row into `public.admins`. That row is read by `public.is_admin()`, which gates only this app's `/admin` pages and a handful of RLS policies/RPCs (write opportunities and evidence, read the audit log, read all events, read feedback summaries). It does **not** give Supabase dashboard/owner access, a service-role key, or the ability to create other admins (API roles have no INSERT/UPDATE/DELETE on `public.admins`).
Target: `alramirez124@gmail.com` (exists, email confirmed, last sign-in 2026-10-03; the same account that owns the Vercel and Supabase projects and is the recovery address for the sender mailbox).
Reverse any time with `supabase/admin/revoke-admin.sql`; both directions are recorded in `public.admin_audit` (migration 20261007).

## Sequence
0. Apply `20261007000000_admin_audit.sql` (idempotent, creates only an unreachable audit table + trigger). Run `supabase/launch/verify_launch_schema.sql`: all checks must pass.
1. Re-read the live FCYLP page (https://www.fairfaxcounty.gov/budget/youth-leadership and its brochure/application page) and compare **every** field of the draft (title, organization, description, deadline, pay, grade/eligibility text, other requirements, source and application URLs). Anything not stated on the official page is cleared or moved to *Other requirements*.
2. **[needs the owner's go-ahead]** Run `supabase/admin/grant-admin.sql`. Confirm 1 row returned and a `grant` row in `admin_audit`.
3. Sign in at the live site as that admin (magic link to the mailbox); open `/admin`, `/admin/analytics`: they must load.
4. Open only the FCYLP draft; tick the comparison box, **Save & verify**. Check the audit log shows the change and the student detail page shows "Last verified <today>" plus the source URL.
5. Disposable student (`alramirez124+oosmoke@gmail.com`, one magic link): onboard with a profile that FCYLP should treat as eligible-or-check (Fairfax VA ZIP, junior, FCPS school), then run the HTTP smoke: explanation lines, detail, save, apply click (`/go`), status, "Not a good match?" feedback, analytics event rows, student blocked from `/admin`.
6. Reminders (safe): with the smoke student saved on FCYLP, the deadline (Nov 8, 2026) is >7 days away, so the endpoint must claim 0. To exercise the 7-/2-day branches without touching real data, rely on the DB tests (`npm run db:test` on scratch Postgres; same functions) and on a read-only look at `claim_due_reminders` output. Do **not** edit FCYLP's deadline. The authorized cron call must return `claimed:0` twice (idempotent).
7. Delete the smoke account via Profile -> Delete (smoke `SMOKE_CLEANUP=1`), confirm `auth.users`/`profiles`/`student_opportunities`/`match_feedback` have no smoke rows, remove local state files.
8. Decide whether to keep the admin row. Revoke with `revoke-admin.sql` if it should not persist.
9. Re-run lint, typecheck, tests, build, public + authenticated smoke, mobile/desktop inspection; update `docs/PRODUCTION_LOG.md`; commit and push.

## Guardrails
No opportunity other than FCYLP is verified. No data is invented. If the official page no longer supports a field, the record stays unverified.
