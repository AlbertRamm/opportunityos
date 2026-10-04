# Data model and privacy decisions

OpportunityOS serves high-school students (13+). The rule is **collect the least that makes eligibility explainable**, keep it in the student's own account, and never put it in analytics, logs, or admin views.

## What a student profile stores
| Group | Columns (`public.profiles`) | Why |
|---|---|---|
| Core (required) | first name, birth date, grade, graduation year, ZIP + state, school name, coarse ZIP centroid, interests, opportunity types, pay/work-mode/travel/availability preferences, reminder opt-in | age/grade/residency rules, ranking, reminders |
| **Match details (optional, V0.1)** | `gpa_value`, `gpa_scale`, `gpa_weighting`, `attest_financial_need`, `attest_citizenship`, `college_plan` | resolve recurring rules that otherwise stay "Check requirement" |

Email lives in `auth.users`. No street address, SSN, income, tax/FAFSA data, documents, race/ethnicity, medical, or immigration status is stored.

## Match details: the decision
Audit of the 30 live records (`npx tsx scripts/audit/match-confidence.mts`) found these recurring unresolved rule types among the records open to a 12th grader: sponsor-specific free text (22), college-plan requirements (8, all in free text), citizenship/PR requirements (9: 3 structured, 6 only in free text), GPA minimums (6), "must have financial need" (4, all in free text), and 5 records with no age/grade rule recorded. We added only attributes that resolve several records and can be a minimal self-attestation:

| Attribute | Stored as | Resolves | Hard fail allowed? |
|---|---|---|---|
| GPA | numeric value + declared scale (4.0 / 5.0 / 100 / other) + weighted / unweighted / not sure | `min_gpa` on 6 records | Only when it cannot be a false negative: a **weighted** GPA below the minimum. An unweighted miss stays "confirm" (the sponsor may count weighted). Only the 4.0 scale is compared; other scales are never converted. Weighting is never assumed. |
| Financial need | yes / no / not sure / prefer not to say | "must have need" on 3 records | **Never.** Need is defined by each sponsor, so "yes" resolves the rule to "the sponsor decides" (Likely, not Strong) and every other answer stays "confirm". No income or documents are asked. |
| Citizenship / residency | yes / no / not sure / prefer not to say to *"I meet U.S. citizenship or permanent-residency requirements commonly used by scholarships"* | citizen / citizen-or-PR rules on 6 records (5 already structured, NIH moved from text) | "No" fails citizen and citizen-or-PR rules (an objective rule), not work-authorization. "Yes" passes citizen-or-PR and work-authorization rules but **cannot** prove a citizens-only rule (a permanent resident would also say yes). The UI and every explanation tell the student to confirm the sponsor's exact rule. The student's actual status is never asked or stored. |
| College plans | four-year / two-year or vocational / undecided / prefer not to say | "plans to attend (four-year) college" on 8 records | **Never** (an intention, not a fact). |

Considered and **not** added: military-dependent status, student-government office, race/ethnicity or other identity (Ron Brown, Omega Psi Phi...), test scores, physical fitness, family income (Hagan). They are sensitive, rare, or not a minimal attestation; those rules stay as sponsor-specific text on the card.

## Matching semantics (src/lib/matching/engine.ts)
- **Not eligible** = a definite failed hard rule only. Missing or "prefer not to say" never causes it and never hides a card.
- **Check requirement** = at least one modeled rule cannot be evaluated (no answer, other GPA scale, county rule, no age/grade info, unverified listing).
- **Likely match** = every modeled rule is known and passes; sponsor-specific conditions (free-text rules, "sponsor decides need") remain and are listed.
- **Strong match** = like Likely with nothing left unresolved, plus an interest overlap and no preference conflicts. **Eligible** = same without interest overlap. Today no live record reaches Strong, because every record carries at least one sponsor-specific condition; we did not relax that to inflate the count.
- Subjective criteria (essay quality, recommendations, selection discretion, need definitions) are never turned into pass/fail.

## Opportunity side
`opportunities.attested_requirements text[]` (`financial_need`, `college_four_year`, `college_any`) marks rules a student can answer. Migration 20261008 moved these from free text to structured fields for 8 verified records (and NIH's citizen-or-PR rule to `citizenship_requirement`), removing only exact-duplicate text lines. Each is backed by a verbatim quote in the batch evidence (`evidence-check.ts`), `last_verified_at` is unchanged, and the audit trigger logged each update.

## Safeguards
- Columns are on the existing user-owned `profiles` row: RLS allows own-row select/insert/update/delete only; `anon` has no access. Defaults are NULL; DB check constraints allow only the coarse enums and a GPA that is all-or-nothing and within its scale.
- Deleting the account (`delete_my_account()`) cascades to the profile row, including these columns.
- Analytics events carry no profile data; `trackEvent` calls and `console.*` calls never reference them (enforced by `src/lib/match-details.test.ts`). `admin_metrics()` and every admin page read aggregates/opportunities only, never `profiles` Match details. No service-role key is used in student paths and nothing is sent to providers.
- The optional section is skippable, editable, and removable (clear the GPA, choose Skip). Onboarding completes without it.
- Student-facing copy: onboarding/profile form, the privacy page, and the explanation text on each card state why a field helps and that it is not shared.
