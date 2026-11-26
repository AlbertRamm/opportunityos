# Loading real opportunities (the part that decides whether this product works)

Principle: **AI/people propose → a human verifies against the official page → the deterministic engine uses it.**
Never copy requirements from memory, aggregator sites ("top 15 summer programs…"), social posts, or search-result snippets.
Smaller and fully verified beats a long list.

## What counts as a valid source
The organization's **own** page (program page, application portal, official PDF/handbook) — read on the day you verify.
Not valid: blogs, listicles, Reddit/TikTok, Google/AI summaries, counselor emails without a link to the official page.

Use `data/leads/career-club-opportunities.json` as a prioritized discovery queue from the Washington Latin Career Club sheet. Its existing review labels are preserved, but even entries labeled “Verified — official” must be rechecked for the current cycle before creating a public record. Reddit can help identify a program or suggest what students found valuable; it is never evidence for dates, eligibility, cost, pay, or availability.

## What to capture per opportunity (all from the page; leave blank if the page doesn't say)
| Need | Field(s) | Notes |
|---|---|---|
| Where you read it | `source_url`, `application_url` | Official pages only |
| Current program cycle | `evidence.current_cycle` | Quote text that shows the application/program cycle currently posted. Old or recurring past cycles are not enough. |
| Deadline | `application_deadline` (+ `application_open_date`) | **Must** be backed by `evidence.application_deadline` (verbatim quote + URL). Rolling programs: `evidence.rolling` quote instead. |
| Eligibility | `min_age`/`max_age` (+`age_reference_date` if "by June 1"), `min_grade`/`max_grade` (grade *at application time*), `eligible_graduation_years`, `allowed_states`, `allowed_zips`, `allowed_counties`, `allowed_schools`, `residency_scope`, `citizenship_requirement`, `min_gpa`, `schedule_period`, `attested_requirements` (`financial_need`, `college_four_year`, `college_any`: only when the page states it; evidence key `need` or `college`) | Only what the page states. Set `residency_scope` to confirmed open only when the official page confirms that there is no residency restriction. |
| Unmodeled eligibility | `unstructured_requirements` (one condition each) | Students see each as needing confirmation. Do not put application directions here. |
| Application directions | `application_instructions` (one direction each) | Use for steps such as starting a school club. These are marked as sponsor instructions, not eligibility checks. |
| School limits | `allowed_schools` | List each explicitly eligible school. Non-exact student school names remain unresolved for sponsor confirmation. |
| Location / pay / cost | `location_*`, `work_mode`, `is_paid`, `compensation_description`, `cost_status`, `cost_min`, `cost_max`, `cost_description` | Unknown cost is not free. Scholarships/competitions can use not applicable for program cost. |
| Type / topics | `opportunity_type`, `interests` | Interests are slugs from the `interests` table |

## Pages the fetch script can't read (bot-blocked, JavaScript-only, or PDF)
`launch:fetch` makes one polite request and stores the text. If a site answers 403, renders with JavaScript, or the source is a PDF:
1. Open the page in a normal browser (or download the official PDF) and copy the visible text into a file. For PDFs on macOS: `osascript -l JavaScript scripts/launch/pdf-to-text.jxa file.pdf > file.txt` (Linux: `pdftotext`).
2. `npx tsx scripts/launch/snapshot-from-text.mts <official url> file.txt` stores it as a dated, hashed snapshot in the same format (zero-width characters from PDF extraction are removed; nothing else is changed).
3. Quote from it as usual; `launch:check-batch` treats it like any other snapshot. Do not use a snapshot for a page you did not actually read on the day.

## Workflow
1. Read the official page. Write the record (see `docs/opportunity-batch.template.json`). Include a current-cycle quote, deadline or rolling quote, and exact evidence for every structured eligibility, pay, cost, schedule, and application fact you enter.
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
