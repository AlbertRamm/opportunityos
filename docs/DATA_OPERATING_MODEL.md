# OpportunityOS data operating model

## Product boundary

OpportunityOS is a year-round DMV directory of things high-school students can do now or plan for the next cycle. It covers internships and youth jobs, summer programs, volunteering, activities, competitions, and learning courses. Prioritize options open to grades 9–10 while retaining useful grade 11–12 options.

Every listing should help answer four questions: can I pursue it, what would I do or learn, what does it cost or pay, and what is my next step? Career connections describe the work, not promised outcomes.

## Source and publication rules

1. Discover leads through the Washington Latin Career Club opportunity registry, school staff, trusted partners, official newsletters, and directories. Treat every row in `data/leads/career-club-opportunities.json` as a lead and preserve its original review status.
2. Use leads only to find the sponsor's own program page, application page, or official document. Directories and Reddit may surface leads or student-experience questions, but never support eligibility, dates, pay, or program details.
3. Publish only after a person checks the official source for the current cycle and records the working source link, action link, checked date, cycle, and evidence for decision-critical claims.
4. If the next cycle is not posted, keep it on an internal watch list. Never present an old deadline as open.
5. Unknown age, grade, residency, cost, pay, dates, and access conditions remain unknown. Do not convert missing details to “all students welcome.”
6. State known costs, unpaid status, and required travel clearly. Students should be able to inspect the official details before providing sensitive information.
7. Each listing has one primary type, a time window, and multiple career areas. Filters combine with AND across groups and OR within a group. Summer + internships + volunteering means either type during summer.

## Audience and geography

Serve DC students and reachable programs in nearby Maryland and Northern Virginia. Include remote programs when DMV students are explicitly eligible. A sponsor's location does not establish a student's residency eligibility. Store participant residency separately from program location.

Capture grade and age, residency, cycle, dates, format, location, schedule, cost or pay, student actions, application method, and evidence. Add career tags only when supported by described activities.

## Canonical records and lifecycle

- Supabase PostgreSQL is the source of truth for published opportunities, saves, and editor changes.
- Each opportunity row describes one student-actionable cycle. Link recurring cycles by a stable series/source identifier when cycle details change.
- JSON batches and the Career Club registry are review and import formats, not a second live catalog.
- Maintain a compact source registry with official URL, sponsor, coverage, access method, and review schedule. A source page never publishes itself.
- `supabase/source-registry-seed.sql` initializes the source registry; `/admin/sources` records the human review outcome and schedules the next check.
- Operational states are lead, draft, verified/current, recheck due, closed, and archived. Existing verification status, last-verified date, and archive fields cover part of this lifecycle. A new cycle is a new record or audited update.
- Only non-sample, verified, non-archived records rechecked in the last 30 days and with no passed application or program end date appear in public browse. The database view returns display fields only; the student dashboard continues to use authenticated RLS.

## Review cadence

Keep the existing 30-day re-verification limit as the maximum age for an active listing. Recheck every 14 days while an application is open, and weekly in the final 30 days before a deadline. Review upcoming-cycle sources monthly from September through February, then every two months. Review rolling volunteering and courses every 60 days. A broken link, sponsor update, or student/counselor report triggers immediate review.

Automated checks can find due records, broken links, changed page hashes, and elapsed deadlines. They can open a review task or mark a listing for attention. They cannot infer eligibility, pay, dates, or availability or change a cycle based on a page diff alone.

Editors work a weekly queue, first reviewing deadlines within 30 days, then open applications, changed or broken source pages, then the oldest checks. During peak summer application season, check priority sources weekly.

## Career connections

Use controlled career areas instead of free-form tags. Start with arts and media; business and entrepreneurship; computers and technology; education and youth work; engineering and skilled trades; environment and natural resources; health and life sciences; law and public service; science and research.

Add a tag only when the listing's tasks or learning goals support it. Do not infer clinical work from a hospital address or engineering from a generic STEM label. Explain each connection briefly using the actual activity description. Counselors can filter by career area and grade without seeing a student's profile.

## Privacy

Public browsing needs no account. Keep profile answers and saved opportunities behind existing row-level security. Do not collect precise home addresses, income, immigration status, health data, school records, or application documents. Do not send profile data to sponsors or analytics. External applications stay on the sponsor's official site.

Before school-wide use, align the privacy page and deletion flow with the data actually collected. Public browsing should be useful without a student account.

## Sources and cost

Use official sponsor pages and documents as evidence. Search and directories are for discovery only. Prefer official portals to custom scraping. No paid data vendor, LLM extraction service, or automated page-to-database publisher is needed.

Keep Next.js, Supabase, and Vercel. Use free tiers for a supervised pilot. Consider Supabase Pro when students rely on saved data or reminders and free-tier pausing/backups are no longer acceptable. Keep reminder emails disabled until a sending domain and low-volume provider are configured. Human verification time is the main operating cost.

## School-ready bar

- Every visible listing has a current-cycle verification date, official source, and working next step.
- No expired deadline appears open.
- Grade 9–10 students can find realistic choices across multiple interests and types.
- Unknown requirements are visible as unknown or requiring confirmation.
- Counselors can share a filtered URL without exposing student data.
- The admin queue shows the next reviews and records who checked them.
- A data owner reviews feedback and stale-source trends weekly.

Catalog size follows verified coverage and review capacity. Do not publish stale records to reach a numeric target.
