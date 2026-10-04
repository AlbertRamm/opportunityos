# Sourcing log (DMV batch 1), as of 2026-10-04

Only official pages. "Snapshot" = dated, hashed text in `data/snapshots/`. Nothing here is verified by a human yet.

## Imported as draft (passes `launch:check-batch`)
| Program | Deadline (verbatim on page) | Notes |
|---|---|---|
| Fairfax County Youth Leadership Program | Sunday, Nov 8, 2026, 11:59 pm | Paid ($1,000). FCPS juniors only; grade left unencoded because the page's "Junior" vs "2027-2028 class" wording is ambiguous about grade at application time. |

## Drafted but NOT importable yet (`data/batches/pending/`)
- **NIST SHIP 2027:** applications "expected to open … mid-October 2026", "due at the end of January 2027", no exact date. Importer requires an exact deadline. Re-fetch https://www.nist.gov/ship and /ship/ship-application-and-selection after opening.

## Rejected / not open (re-check dates)
| Program | Why |
|---|---|
| GMU ASSIP | 2026 application closed; 2027 not posted (re-fetch https://science.gmu.edu/assip in Nov-Dec) |
| DC MBSYEP, DCTAG | 2026 cycle closed (DCTAG closed Aug 21, 2026) |
| JHU APL ASPIRE | Timeline says Jan 1 - Feb 15 with no year and page copy still says summer 2026; do not infer. Re-check after Jan 1 |
| NASA OSTEM internships | Official page limits it to college-level students |
| UMD Geography HIP | "will open early 2027", no dates |
| UVA Inspire (Fairfax) | Paid summer classes, rolling, "applications … open in late fall" |
| UMD IBBR high school internship | 2026 closed (due 02/13/2026) |
| UM Scholars (UMB) | UMCP undergraduates only |
| DC Public Library Teen Council | 2026 deadline passed (Jan 8); "check back next year" |
| BroadFutures | Ages 18-26 |
| State Dept Student Internship | 18+, college credits |
| PGCC Promise Scholarship | Priority deadline "March 1" has no year; college program, not HS |
| MCPS Summer RISE | Registration opens January 2027; no deadline stated |

## Unreachable from the agent's network (need a human in a browser)
- **Navy SEAP (high school, paid $3,500/8 wks, reportedly open through Nov 30, 2026):** seap.asee.org is not resolvable here; onr.navy.mil returns 503; navsea.navy.mil returns 403. Search-snippet claims are *unverified*. **Time-sensitive: check https://seap.asee.org now.**
- NIH Summer Internship Program (Cloudflare block), Smithsonian (si.edu / internships.si.edu 403), Library of Congress (loc.gov 403), Prince George's County government (403), NASA Goddard HS-specific pages not yet read.
- Urban Alliance (DC, paid, rising seniors): page fetched but states no current deadline or eligibility on the fetched text; ask them or read the interest form.

## Snapshots
`data/snapshots/` is in `.gitignore` (runbook: archive privately). These snapshots contain only public official-page text, so they were force-added for this batch so the evidence is reproducible; `launch:check-batch` needs them (max age 7 days by default, so re-run `launch:fetch` before any later import).
