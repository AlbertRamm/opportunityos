# Sourcing log (DMV), as of 2026-10-04

Only first-party official pages. "Snapshot" = dated, hashed text of the page in `data/snapshots/` (the ones backing verified records are committed). Every verified record was imported from a batch that passed `launch:check-batch` (each decision field quoted verbatim from a snapshot fetched the same day), then compared field by field in `/admin` and verified on **2026-10-04**.

## Verified and live to students: 30 records (17 from batches 1-2, 13 from batch 3 below)
| # | Opportunity | Deadline (as stated on the page) | Primary source |
|---|---|---|---|
| 1 | Fairfax County Youth Leadership Program (FCYLP) | Nov 8, 2026 | fairfaxcounty.gov/budget/youth-leadership (batch 1) |
| 2 | Science and Engineering Apprenticeship Program (SEAP), U.S. Navy | Nov 30, 2026 (opens Sept 15) | navalsteminterns.us/internships/seap |
| 3 | US Senate Youth Program, DC delegates | Oct 27, 2026 | osse.dc.gov (service + application pages) |
| 4 | Regeneron Science Talent Search 2027 | Nov 5, 2026 | societyforscience.org/regeneron-sts + 2027 Official Rules PDF |
| 5 | TeenWorks Employment Program (Montgomery County, MD) | Nov 30, 2026 (Aug 1 open) | montgomerycountymd.gov (Recreation) |
| 6 | Congressional App Challenge 2026 | Oct 26, 2026 | congressionalappchallenge.us/students/rules |
| 7 | VFW Voice of Democracy 2026-27 | Oct 31, 2026 | vfw.org/community/youth-and-education/youth-scholarships |
| 8 | Cooke College Scholarship Program | Nov 11, 2026 | jkcf.org (College Scholarship Program) |
| 9 | Elks National Foundation Most Valuable Student | Nov 12, 2026 | elks.org/scholars/scholarships/MVS.cfm |
| 10 | NIH Summer Internship Program 2027 (HS seniors) | Jan 26, 2027 (opens Oct 13, 2026) | training.nih.gov (read in a browser; site blocks scripts) |
| 11 | Virginia Summer Residential Governor's School 2027 (FCPS) | Dec 11, 2026 | fcps.edu (SRGS page) |
| 12 | Ron Brown Scholar Program | Dec 1, 2026 | ronbrown.org/ron-brown-scholarship (read in a browser) |
| 13 | Burger King Scholars 2027-28 | Dec 15, 2026 (opens Oct 15) | burgerkingfoundation.org |
| 14 | US Senate Page Program, Spring 2027 (Sen. Alsobrooks' office) | Oct 31, 2026 | alsobrooks.senate.gov |
| 15 | Research Science Institute (RSI) 2027 | Dec 11, 2026 | cee.org |
| 16 | YoungArts National Arts Competition 2027 | Oct 6, 2026 (closes in days) | youngarts.org |
| 17 | Hispanic Heritage Youth Awards 2026-27 | Nov 1, 2026 | hhfawards.hispanicheritage.org |
| 18 | Chick-fil-A Community Scholars (2027-2028) | 2026-11-03 | https://www.chick-fil-a.com/community-scholars (Tier 1 official) |
| 19 | Hagan Scholarship (2027-2028) | 2026-12-01 | https://haganscholarships.org/Application (Tier 1 official) |
| 20 | Coolidge Scholarship (2026-27 cycle, for juniors) | 2026-12-01 | https://coolidgescholars.org/eligibility/ (Tier 1 official) |
| 21 | FRA Americanism Essay Contest 2026-2027 (grades 7-12) | 2026-12-01 | https://www.fra.org/fra/Web/Web/Content/Essay_Contest.aspx (Tier 1 official) |
| 22 | John F. Kennedy Profile in Courage Essay Contest 2027 | 2027-01-11 | https://www.jfklibrary.org/learn/education/profile-in-courage-essay-contest/for-student-participants/eligibility-and-requirements (Tier 1 official) |
| 23 | Nancy Thorp Poetry Contest (63rd annual) | 2026-10-31 | https://www.hollins.edu/academics/pre-college-experiences-camps/nancy-thorp-poetry-contest/ (Tier 1 official) |
| 24 | Omega Psi Phi International High School Essay Contest 2026 | 2026-10-31 | https://oppf.org/international-high-school-essay-contest/ (Tier 1 official) |
| 25 | Military Child of the Year Award 2027 (nominations) | 2026-12-01 | https://operationhomefront.org/military-child-of-the-year/ (Tier 1 official) |
| 26 | VCU first-year university-level scholarships (Fall 2027, Nov. 1 deadline) | 2026-11-01 | https://admissions.vcu.edu/apply-to-vcu/deadlines/ (Tier 1 official) |
| 27 | Virginia Tech Stamps Scholarship (Early Action, Fall 2027) | 2026-11-15 | https://honorscollege.vt.edu/Scholarships/recruitment/Stamps.html (Tier 1 official) |
| 28 | Toshiba/NSTA ExploraVision 2027 | 2027-01-27 | https://www.exploravision.org/rules-requirements/ (Tier 1 official) |
| 29 | Army ROTC Scholarship for the High School Class of 2027 | 2027-03-04 | https://www.goarmy.com/careers-and-jobs/find-your-path/army-officers/rotc/scholarships (Tier 1 official) |
| 30 | Air Force ROTC High School Scholarship Program (2027-2028 academic year) | 2026-12-11 | https://www.afrotc.com/scholarships/high-school/application/ (Tier 1 official) |

Batch 3 was imported through Admin -> Import as `2026-10-scholarships-batch-3` (dry run 13/13 valid, 13 drafts), compared field by field and verified 2026-10-04. Source tier for every record: **Tier 1, first-party sponsor/college/government page**. Directories (BigFuture, Scholarship America, Fastweb, UNCF lists) were used for discovery only; none backs a record. Fastweb article lists were re-read on 2026-10-04 and showed only 2025 or already-closed dates, so nothing was taken from them.

### Catalog composition (30 live)
- Scholarship type (13): Cooke, Elks MVS, Ron Brown, Burger King, HHF Youth Awards, Chick-fil-A, Hagan, Coolidge, VCU, VT Stamps, Army ROTC, AFROTC, USSYP (DC).
- Competitions/essays (10): Regeneron STS, Congressional App Challenge, VFW VOD, YoungArts, FRA, JFK, Thorp, Omega Psi Phi, MCOY, ExploraVision (most carry cash or scholarship awards).
- Place-based DMV program/job/research (7): FCYLP, TeenWorks, SEAP, NIH SIP, Virginia SRGS, Senate Page (MD), RSI (residential, open nationally).
- Nationwide/online-eligible: 23; in-person/place-based: 7. Untestable rules (citizenship exceptions, financial need, identity, partner routing) are stored as "Other requirements" so matching shows Needs confirmation rather than a false yes.

### Batch 3 rejections (additional to the table below; 55 candidates rejected in total across the whole sourcing effort)
| Candidate | Reason |
|---|---|
| Gates Scholarship, QuestBridge | Closed for this cycle |
| Doodle for Google | Only 2025 dates; page is JS-only |
| AABE DC | Official page says "Applications are now closed" (aggregator claim contradicted) |
| Greenhouse, Daniels Fund, Dell Scholars | Wrong states (not DMV-eligible) |
| NSHSS | Member-only |
| Jack Kent Cooke Young Scholars | Grade 7 only |
| Amazon Future Engineer | Stale 2026 page |
| Davidson Fellows | "2027 application will open in Fall 2026", no date |
| BigFuture $40K drawing, Niche, Fastweb invite-a-friend, Dr Pepper, Huntington | Sweepstakes/drawing-style offers |
| Create-A-Greeting-Card, College JumpStart, Design Your Space | Unclear sponsor; lead-gen |
| GW SJT, UMD Banneker/Key, GMU merit, MHEC, SAR Knight essay | Month/day with no year or stale (2025) on the page |
| Montgomery Scholars, Montgomery Early College | No deadline/date |
| CyberPatriot, NCWIT AiC, BoA Student Leaders, YES Abroad | Coach registration/fee page unreadable, or not student-actionable |
| Alexandria SYEP, Arlington teen jobs, Howard/Loudoun YAC, CBF student leadership, NGA Teen Leadership Collective, NPG Teen Museum Council, NESST, MBYLI, HSIP, DC YHRA | 2026 windows closed or next dates not published |
| Ayn Rand essays | Deadline TBD |
| SWE, NSBE, SHPE | Closed or member-only |
| Horatio Alger | Site blocked; senior window unverified |
| Princeton Prize | JS-only page not read |
| Prudential Emerging Visionaries | Domain unresolved |
| MD USSYP, VA USSYP | MSDE down / closed Sept 25 |
| HSF, Taco Bell Live Mas | Open Jan 1 / dates unannounced |
| Red Cross Leaders Save Lives, Letters About Literature | No current page / program ended |
| Jackie Robinson, Posse | Closed / nomination-only |

Notes on encoding: where the page gives a rule we cannot test (citizenship exceptions, "16 by start date", leadership positions, financial need, partner-school routing), it is stored as an "Other requirement" so students see **Needs confirmation** rather than a wrong yes/no. A few pages state a window with a month/day but no year (VFW "Oct. 31", TeenWorks "Aug. 1 - Nov. 30", Ron Brown "December 1", SEAP "Sept. 15 - Nov. 30"); the year was taken from the same page's explicit 2026-27 / 2027 cycle labels and today's date, and each record cites those labels.

## Target status: 30 verified (low end of the 30-50 goal); more are limited by publication timing
Earlier note (batches 1-2 era): the goal assumed 30+ DMV high-school opportunities would have exact, current, primary-source dates in early October. They do not: most DMV programs (GMU ASSIP, JHU APL ASPIRE, UMD, county summer-jobs programs, NIST SHIP, library teen councils, most scholarships) publish their next-cycle dates between November and January. Padding with expired, undated, or aggregator-sourced listings would break the product's one promise (trustworthy dates), so we did not.

### Found, checked, and **not** imported
| Program | Why not |
|---|---|
| Smithsonian NMNH Summer High School Internship | Official page still shows the closed 2026 cycle (deadline Mar 20, 2026); 2027 dates appear only on third-party sites |
| NIST SHIP 2027 | "expected to open mid-October 2026 ... due at the end of January 2027": no exact date. Re-fetch https://www.nist.gov/ship after it opens |
| Maryland USSYP | MSDE site down for maintenance when checked; Virginia USSYP closed Sept 25 |
| Coca-Cola Scholars | Closed Sept 30, 2026 |
| NSA Stokes | Not read from an official page here; search snippets say the STEM window closed Sept 30 |
| Senate Page via Sen. Warner (VA) | Spring deadline Oct 5 (tomorrow); eligibility rules are on a separate page, so grade/age could not be quoted from the cited page |
| Montgomery TAB (libraries), Loudoun YAC, Howard YAC | Rolling or closed; no deadline stated |
| MHEC scholarships/grants (Rawlings, Senatorial, Delegate) | Deadlines are "March 1" with no year (same reason PGCC was rejected earlier) |
| Genesys Works NCR, Urban Alliance, FCPS Summer Internship, APS PRIME | No current-cycle deadline stated on the fetched official page |
| Dell Scholars | Texas-only (search snippet; official page not read) |
| Horatio Alger, Jackie Robinson Foundation, Posse | Windows closed or nomination-only (search snippets; official pages not read) |
| NSLI-Y 2027-28 | "expected in November 2026", no exact date |
| DC YHRA, DC HSIP, DC MBYLI, DC DCTAG, MD Youth Transit Council, Prince George's SYEP | Deadlines already passed for this cycle |
| CRCD D.C. Fellowship | College-level program |
| Vision Zero Youth Ambassadors / S.M.A.R.T. YAC (Montgomery) | Only 2023 press releases found |

## Re-check calendar (do these before the next import)
- **Oct 13:** NIST SHIP posting on USAJOBS; GMU ASSIP (early Dec); JHU APL ASPIRE (Jan 1); NIH SIP opens Oct 13 (already imported).
- **Nov-Dec:** UMD, Georgetown, GWU pre-college dates; CFNOVA scholarships (Jan); DC DCTAG / SYEP (Jan-Feb); Smithsonian NMNH 2027; MCPS Summer RISE (Jan); Maryland and Virginia USSYP 2028 cycle.
- Re-verify every record on its listed deadline's anniversary, or sooner if the official page changes (`Admin -> Needs re-verification`).

## Snapshots
`data/snapshots/` is git-ignored by default (audit evidence); the snapshots that back verified records (batch 1 and batch 2) are force-added so the evidence is reproducible. `launch:check-batch` only accepts snapshots under 7 days old, so re-run `launch:fetch` (or `snapshot-from-text.mts` for browser/PDF text) before any later import.
