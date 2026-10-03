# OpportunityOS V0 — design notes

## Principles
1. **Deterministic eligibility.** `src/lib/matching/` is pure TypeScript: (student profile, verified opportunity, today) → result. No network, no LLM, no DB. Fully unit-tested.
2. **Never infer.** `null` on an opportunity means "not stated", not "open to everyone". The engine only claims *Eligible* when it could check every recorded requirement *and* the record says who may apply (age/grade/class year).
3. **Humans verify.** Students only ever see `verification_status = 'verified'`, non-archived rows (enforced by Postgres RLS, not just app code). Future AI extraction can only write `unverified` drafts.
4. **No service-role key in the app.** All access goes through the signed-in user's JWT + RLS. Admin = row in `admins`; `is_admin()` is used by policies. Cross-user aggregates go through `SECURITY DEFINER` functions that check `is_admin()`.
5. **Measure honestly.** Clicking Apply is logged as `application_link_clicked`, never as an application. "Applied/Interview/Accepted" come only from the student's own self-report.

## Match states (engine output)
| State | Meaning |
|---|---|
| Not Eligible | ≥1 known hard requirement fails (age, grade, class year, state/ZIP residency, availability, deadline passed, program ended) |
| Check Requirement | No known failure, but ≥1 requirement can't be evaluated (citizenship/GPA — we don't collect them; unstructured requirements; county restriction; no age/grade info recorded; unverified record) |
| Eligible | All recorded hard requirements pass |
| Strong Match | Eligible + interest overlap + opportunity type selected by student + no preference conflicts |

Preferences (paid, remote/in-person, distance, type) never make someone ineligible; they only affect Strong Match and ordering.

## Edge cases handled
- Age is evaluated on `age_reference_date` if given. If absent and the program starts later, and the result would differ between today and the program start, the result is *unknown* rather than a guess.
- Deadline = last day to apply, inclusive, in America/New_York.
- No deadline → shown as "No deadline listed", not penalized, but flagged for confirmation.
- County restrictions can't be checked (we collect ZIP only) → unknown, unless the student's ZIP is in the explicit ZIP allow-list.
- Stale verification (older than `REVERIFY_AFTER_DAYS`, default 30) → warning flag; does not change the state.

## Extensibility map
| Future feature | Where it plugs in |
|---|---|
| New interests | row in `interests` table (no code change) |
| Other metro areas / national | `allowed_states` + `region` can be added; geography is data, not code |
| AI extraction | `src/lib/extraction/` interface; writes unverified drafts only |
| Notifications | `events` + `student_opportunities` hold what's needed; add a cron job reading deadlines |
| Counselor / org accounts | add `role` tables beside `admins`; add `submitted_by` + `unverified` flow on `opportunities` |
| Duplicate detection | `source_url`/`application_url` are stored normalized-ready; add unique index later |

## V0.2 additions
- **Provenance**: `opportunity_admin` (admin-only RLS) stores import batch + per-field source quotes; `opportunity_audit` (trigger, admin-only) logs every change with who/when/what. Imports can only create **unverified** drafts; verification requires the reviewer to confirm they compared the source.
- **Feedback**: `match_feedback` (own-rows RLS, picklist only, no free text). Admin sees aggregates only; per-opportunity detail is suppressed until ≥3 different students answered.
- **Reminders**: the cron route holds no privileged key. `claim_due_reminders(secret, today)` (SECURITY DEFINER, secret stored as SHA-256) atomically inserts a `reminder_log` claim per (student, opportunity, kind, deadline) *before* sending — the unique key is the idempotency guarantee.
