# Independent OpportunityOS review prompt

Attach the current OpportunityOS code folder in Gemini Apps using **Add files → More uploads → Import code → Upload folder**. Attach `OpportunityOS-Audit.pdf` from the project outputs as a second file. Use Google AI Pro if available for the larger context window.

Paste this prompt after both items finish uploading.

---

Act as an independent senior product designer, full-stack engineer, data quality lead, and youth-opportunity researcher reviewing OpportunityOS. This is a critique and verification task. Do not edit files, generate replacement code, deploy, or assume the previous audit is correct.

OpportunityOS helps high-school students find real opportunities they can pursue, understand eligibility and cost, and take the next step. Its initial focus is DC, Maryland, and Virginia, with virtual or nationwide options when students in the region can actually participate. The student-facing product should be clear, trustworthy, welcoming, and useful on mobile.

Read the complete current code folder and the attached November 25 audit. The audit describes a prior source revision, so treat each finding and suggested fix as a hypothesis. Re-check whether it is still present in the current source. Distinguish confirmed code behavior from data-dependent claims and from recommendations.

Review these areas in depth.

1. Student journey and interface
   - Landing page, browse preview, sign-in and onboarding, dashboard, opportunity details, saved opportunities, and empty/error states.
   - Whether a student can tell quickly what fits, why it fits, whether applications are open, what it costs or pays, and what action to take.
   - Information density, hierarchy, mobile behavior, accessibility, language, and visual consistency.

2. Opportunity sourcing and catalog quality
   - Source hierarchy, current-cycle evidence, geographic eligibility, age and grade rules, deadlines, cost/pay, format, duplicate programs, lifecycle states, and re-verification.
   - Whether the data model can represent what students need without using free text as a substitute for structured facts.
   - Whether the workflows prevent an unreviewed or stale listing from reaching recommendations.
   - Check what the code and included catalog files actually establish. Do not claim that external program facts were independently verified unless you checked the cited primary source.

3. Matching and ranking
   - Trace the real dashboard data path into the matching engine and final groups.
   - Test edge cases from the source and tests, including stale verification, future openings, missing deadlines, unknown pay or format, county and school restrictions, age/grade changes, sponsor instructions, and user preferences.
   - Explain whether labels such as Strong Match, Likely Match, Eligible, and Needs confirmation have precise and consistent meanings.
   - Identify cases where unknown facts could create false confidence or hide useful results.

4. Engineering and operations
   - Architecture, data access and RLS, validation, admin/import flows, migrations, security, privacy, accessibility, analytics, reminders, performance, testing, and release process.
   - Identify duplicated logic or unnecessary complexity only when you can point to the specific maintenance cost. Do not recommend shortening code solely to reduce line count.
   - Check whether the documented operating model and launch instructions match the code.

5. Missing student capabilities and what to add
   - Identify important student tasks OpportunityOS does not support well yet. Look for gaps in discovery, evaluating feasibility, planning around deadlines, saving and revisiting options, taking action, and getting help when information is unclear.
   - Consider features such as side-by-side comparison, deadline/calendar support, application progress tracking, alerts, counselor sharing, transport or schedule feasibility, and reporting incorrect information. Recommend them only when a specific gap in the current product justifies them.
   - Separate capabilities that are genuinely missing from problems that should be fixed in existing features, data that should be collected or verified, and ideas that should wait.
   - For each proposed addition, state the student need, evidence in the current product or supplied audit, a small first version, data/privacy/operational dependencies, implementation effort, a way to measure whether it helped, and priority.

Evidence requirements

- For each finding, cite exact repository paths and line numbers, or identify the relevant attached-audit page. Quote only short snippets where necessary.
- State the observed behavior, why it matters to a student or operator, severity, confidence, and a practical correction.
- Label claims as confirmed in source, confirmed in supplied data, supported by the older audit only, or needing live/primary-source verification.
- Do not invent usability-test results, production measurements, source checks, or student outcomes.
- Identify findings from the older audit that appear fixed in the current code. Do not repeat them as open defects.
- If a file, route, dataset, or path was not actually inspected, say so. Do not imply full coverage unless you have read the full folder.
- Prioritize the five changes that most reduce the chance of a student being misled or stuck. Also identify up to three new capabilities worth adding, ranked by student value and evidence. Separate release blockers, fixes to existing features, new capabilities, and later ideas.

Return a concise executive summary first, then a ranked findings table with columns for severity, area, evidence, student/operator impact, confidence, and correction. Follow it with a system walkthrough, a list of corrected or no-longer-applicable audit findings, the three best-supported capabilities to add, unresolved questions requiring production access or primary-source checks, and a 1–2 week implementation order. Be candid and specific. Avoid generic praise, generic design advice, and speculative feature ideas.
