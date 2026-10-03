# Loading real opportunities (the part that decides whether this product works)

Principle: **AI/people propose → a human verifies against the official page → the deterministic engine uses it.**
Never copy requirements from memory, aggregator sites ("top 15 summer programs…"), social posts, or search-result snippets.
Smaller and fully verified beats a long list.

## What counts as a valid source
The organization's **own** page (program page, application portal, official PDF/handbook) — read on the day you verify.
Not valid: blogs, listicles, Reddit/TikTok, Google/AI summaries, counselor emails without a link to the official page.

## What to capture per opportunity (all from the page; leave blank if the page doesn't say)
| Need | Field(s) | Notes |
|---|---|---|
| Where you read it | `source_url`, `application_url` | Official pages only |
| Deadline | `application_deadline` (+ `application_open_date`) | **Must** be backed by `evidence.application_deadline` (verbatim quote + URL). Rolling programs: `evidence.rolling` quote instead. |
| Eligibility | `min_age`/`max_age` (+`age_reference_date` if "by June 1"), `min_grade`/`max_grade` (grade *at application time*), `eligible_graduation_years`, `allowed_states`, `allowed_zips`, `allowed_counties`, `citizenship_requirement`, `min_gpa`, `schedule_period` | Only what the page states |
| Everything you can't encode | `unstructured_requirements` (one string each) | Each becomes "Check Requirement" for students — that's correct and honest |
| Location / pay | `location_*`, `work_mode`, `is_paid`, `compensation_description` | Scholarships/competitions: leave `is_paid` out |
| Type / topics | `opportunity_type`, `interests` | Interests are slugs from the `interests` table |

## Workflow
1. Read the official page. Write the record (see `docs/opportunity-batch.template.json`). For every date/eligibility decision you rely on, paste the exact sentence as `evidence`.
2. Admin → **Import from URL** → paste the JSON, name the batch (e.g. `2026-10-dmv-batch-1`) → **Validate (dry run)** → fix errors → **Create drafts**.
   - Drafts are **unverified** and invisible to students. Duplicates (same source/application URL) are skipped. Placeholder hosts (example.org, localhost…) are rejected.
3. Open each draft (**Review & verify →**). Compare every field and each evidence quote with the live page. Tick *"I compared every field…"* → **Save & verify**. That stamps the verification date and your account.
4. Every change is recorded (who/when/which fields) in the draft's **Change history**.
5. Re-check regularly: Admin → *Needs re-verification* → open the official page → **Re-checked: nothing changed** (or edit and re-verify). Listings older than `REVERIFY_AFTER_DAYS` show a "needs recheck" flag to students.
6. Before launch run `supabase/remove-samples.sql` so fictional samples disappear.

## Leads to check (NOT verified — I could not read any of these pages)
Organizations commonly relevant to DMV high-schoolers. Existence, current cycle, deadlines and eligibility are all **unknown until you read the official page**:
- Smithsonian Office of Academic Appointments & Internships (high-school internships)
- NIH Summer Internship Program in Biomedical Research (Bethesda, MD)
- NIST high-school/summer programs (Gaithersburg, MD) · NASA Goddard (Greenbelt, MD) via NASA's intern portal
- Library of Congress internships · Johns Hopkins APL (Laurel, MD)
- DC Department of Employment Services — Marion S. Barry Summer Youth Employment Program (DC residents)
- DC OSSE — DC Tuition Assistance Grant (DCTAG) · BroadFutures (DC)
- George Mason University — Aspiring Scientists' Summer Internship Program (VA)
- County public-school service-learning/work-based-learning offices (MCPS, FCPS, PGCPS, APS, DCPS)
- Science & Engineering Fair of Metropolitan Washington · University pre-college programs (UMD, GMU, Georgetown, American, Howard)
- Local community foundations' scholarship pages

## Why this is the product's moat
Anyone can publish a list. What students and counselors can't get elsewhere: each result says **why** (every rule shown), flags what we couldn't confirm, shows the **date a human last verified it** and the official link, and is local to DC/MD/NoVA. Protect those three things; don't add unsourced listings to look bigger.
