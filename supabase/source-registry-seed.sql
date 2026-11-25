-- Idempotent seed for official and discovery source locations. Entries remain on watch
-- until a human has reviewed the source and created a current-cycle opportunity.
insert into public.opportunity_sources
  (id, name, owner, source_url, source_role, regions, opportunity_types, notes, review_interval_days, status)
select id, name, owner, source_url, source_role, regions, opportunity_types, notes, review_interval_days, status
from jsonb_to_recordset($sources$
[
  {
    "id": "dc-does-hsip",
    "name": "DC High School Internship Program",
    "owner": "DC Department of Employment Services",
    "source_url": "https://summerjobs.dc.gov/page/hsip",
    "source_role": "official_sponsor",
    "regions": [
      "DC"
    ],
    "opportunity_types": [
      "internship"
    ],
    "notes": "District high-school students, ages 14–21, grades 9–12; cycle currently closed for 2026–27 per youth page, recheck next cycle.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "dc-does-mbsyep",
    "name": "Mayor Marion S. Barry Summer Youth Employment Program",
    "owner": "DC Department of Employment Services",
    "source_url": "https://does.dc.gov/service/mayor-marion-s-barry-summer-youth-employment-program",
    "source_role": "official_sponsor",
    "regions": [
      "DC"
    ],
    "opportunity_types": [
      "job",
      "summer_program"
    ],
    "notes": "District youth; check each annual application for age/residency and dates.",
    "review_interval_days": 7,
    "status": "watch"
  },
  {
    "id": "dcpl-volunteering",
    "name": "DC Public Library volunteer opportunities",
    "owner": "DC Public Library",
    "source_url": "https://www.dclibrary.org/get-involved/volunteer-library",
    "source_role": "official_sponsor",
    "regions": [
      "DC"
    ],
    "opportunity_types": [
      "volunteering",
      "activity"
    ],
    "notes": "Official umbrella page says regular and periodic opportunities start at age 14; individual position availability must be checked.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "dcpl-teen-volunteer",
    "name": "DCPL Teen Volunteer postings",
    "owner": "DC Public Library",
    "source_url": "https://dclibrary.galaxydigital.com/need/",
    "source_role": "official_application_portal",
    "regions": [
      "DC"
    ],
    "opportunity_types": [
      "volunteering"
    ],
    "notes": "Use each active posting for current seats, age, location, and registration status.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "smithsonian-qcrew",
    "name": "Q?Crew Teen Volunteers",
    "owner": "Smithsonian National Museum of Natural History",
    "source_url": "https://naturalhistory.si.edu/education/youth-programs/qcrew-teen-volunteers",
    "source_role": "official_sponsor",
    "regions": [
      "DC",
      "MD",
      "VA"
    ],
    "opportunity_types": [
      "volunteering",
      "activity"
    ],
    "notes": "High-school students ages 14–18 in the DC metro area; next application information expected early 2027.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "smithsonian-youth",
    "name": "Smithsonian youth programs",
    "owner": "Smithsonian Institution",
    "source_url": "https://www.si.edu/learn/youth-programs",
    "source_role": "official_directory",
    "regions": [
      "DC",
      "MD",
      "VA"
    ],
    "opportunity_types": [
      "internship",
      "volunteering",
      "activity",
      "summer_program"
    ],
    "notes": "Portal for program leads; confirm each museum program page.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "smithsonian-nmnh-hsip",
    "name": "NMNH High School Internship Program",
    "owner": "Smithsonian National Museum of Natural History",
    "source_url": "https://naturalhistory.si.edu/education/youth-programs/high-school-internship-program",
    "source_role": "official_sponsor",
    "regions": [
      "DC",
      "MD",
      "VA"
    ],
    "opportunity_types": [
      "internship",
      "summer_program"
    ],
    "notes": "Ages 15–18, grades 9–12, DMV commute; verify current cycle before listing.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "nist-ship",
    "name": "Summer High School Internship Program",
    "owner": "National Institute of Standards and Technology",
    "source_url": "https://www.nist.gov/ship",
    "source_role": "official_sponsor",
    "regions": [
      "MD"
    ],
    "opportunity_types": [
      "internship",
      "research",
      "summer_program"
    ],
    "notes": "2027 Gaithersburg vacancies announced; source currently states U.S. citizen, high-school junior/senior, GPA 3.0 unweighted.",
    "review_interval_days": 7,
    "status": "watch"
  },
  {
    "id": "naval-stem-seap",
    "name": "Science and Engineering Apprenticeship Program",
    "owner": "U.S. Naval STEM",
    "source_url": "https://navalsteminterns.us/internships/seap/",
    "source_role": "official_sponsor",
    "regions": [
      "MD",
      "VA"
    ],
    "opportunity_types": [
      "internship",
      "research",
      "summer_program"
    ],
    "notes": "Check live vacancy announcements for age, grade, citizenship, and deadline.",
    "review_interval_days": 7,
    "status": "watch"
  },
  {
    "id": "mcps-summer-rise",
    "name": "Summer RISE",
    "owner": "Montgomery County Public Schools",
    "source_url": "https://www.montgomeryschoolsmd.org/departments/CTE/summer-rise/",
    "source_role": "official_sponsor",
    "regions": [
      "MD"
    ],
    "opportunity_types": [
      "internship",
      "summer_program"
    ],
    "notes": "County students; verify current employer placements and eligibility.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "moco-teenworks",
    "name": "TeenWorks",
    "owner": "Montgomery County Recreation",
    "source_url": "https://www.montgomerycountymd.gov/rec/activitiesandprograms/teenworks.html",
    "source_role": "official_sponsor",
    "regions": [
      "MD"
    ],
    "opportunity_types": [
      "job",
      "summer_program"
    ],
    "notes": "Montgomery County residents; verify cohort window and age requirements.",
    "review_interval_days": 7,
    "status": "watch"
  },
  {
    "id": "fairfax-youth-leadership",
    "name": "Fairfax County Youth Leadership Program",
    "owner": "Fairfax County Department of Management and Budget",
    "source_url": "https://www.fairfaxcounty.gov/budget/youth-leadership",
    "source_role": "official_sponsor",
    "regions": [
      "VA"
    ],
    "opportunity_types": [
      "internship",
      "summer_program",
      "activity"
    ],
    "notes": "FCPS-specific rising juniors; next cycle must be confirmed.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "jhu-apl-aspire",
    "name": "ASPIRE high-school internship",
    "owner": "Johns Hopkins Applied Physics Laboratory",
    "source_url": "https://www.jhuapl.edu/Education/Internships/ASPIRE",
    "source_role": "official_sponsor",
    "regions": [
      "MD"
    ],
    "opportunity_types": [
      "internship",
      "research",
      "summer_program"
    ],
    "notes": "Check current cycle and age/grade/location conditions on official page.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "gmu-assip",
    "name": "Aspiring Scientists Summer Internship Program",
    "owner": "George Mason University",
    "source_url": "https://science.gmu.edu/assip",
    "source_role": "official_sponsor",
    "regions": [
      "VA"
    ],
    "opportunity_types": [
      "internship",
      "research",
      "summer_program"
    ],
    "notes": "Check current application dates, age, and program fee or aid.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "nasa-internships",
    "name": "NASA student opportunities",
    "owner": "NASA",
    "source_url": "https://www.nasa.gov/learning-resources/internship-programs/",
    "source_role": "official_directory",
    "regions": [
      "MD",
      "remote"
    ],
    "opportunity_types": [
      "internship",
      "research",
      "summer_program"
    ],
    "notes": "Discover leads only; verify high-school eligibility on each posting.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "dpr-youth",
    "name": "DC Department of Parks and Recreation youth programs",
    "owner": "DC Department of Parks and Recreation",
    "source_url": "https://dpr.dc.gov/",
    "source_role": "official_directory",
    "regions": [
      "DC"
    ],
    "opportunity_types": [
      "activity",
      "volunteering",
      "course"
    ],
    "notes": "Discover seasonal youth programs; check individual registration and age rules.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "smithsonian-internships",
    "name": "Smithsonian internship opportunity portal",
    "owner": "Smithsonian Institution Office of Academic Appointments and Internships",
    "source_url": "https://internships.si.edu/",
    "source_role": "official_directory",
    "regions": [
      "DC",
      "MD",
      "VA"
    ],
    "opportunity_types": [
      "internship",
      "research",
      "summer_program"
    ],
    "notes": "Discovery portal; most listings are not high-school eligible, so verify individually.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "openajar-discovery",
    "name": "OpenAjar opportunity discovery",
    "owner": "OpenAjar",
    "source_url": "https://www.openajar.org/opportunities",
    "source_role": "discovery_only",
    "regions": [
      "national",
      "remote"
    ],
    "opportunity_types": [
      "internship",
      "competition",
      "summer_program",
      "scholarship"
    ],
    "notes": "Discovery only. Never use as a public record's evidence.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "reddit-discovery",
    "name": "Student experience discussions",
    "owner": "Reddit communities (discovery only)",
    "source_url": "https://www.reddit.com/",
    "source_role": "discovery_only",
    "regions": [
      "national",
      "remote"
    ],
    "opportunity_types": [
      "internship",
      "volunteering",
      "activity",
      "course",
      "competition"
    ],
    "notes": "Use anecdotes to discover lesser-known programs and assess student experience. Never treat posts as proof of current availability, eligibility, safety, cost, or quality.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "harvard-pll",
    "name": "Harvard free and low-cost online courses",
    "owner": "Harvard University Division of Continuing Education",
    "source_url": "https://pll.harvard.edu/catalog/free",
    "source_role": "official_directory",
    "regions": [
      "remote"
    ],
    "opportunity_types": [
      "course"
    ],
    "notes": "Course discovery; confirm enrollment mode, cost, and age suitability on each course page.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "mit-ocw",
    "name": "MIT OpenCourseWare",
    "owner": "Massachusetts Institute of Technology",
    "source_url": "https://ocw.mit.edu/",
    "source_role": "official_directory",
    "regions": [
      "remote"
    ],
    "opportunity_types": [
      "course"
    ],
    "notes": "Free self-study materials; distinguish open materials from instructor support or credentials.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "khan-academy",
    "name": "Khan Academy",
    "owner": "Khan Academy",
    "source_url": "https://www.khanacademy.org/",
    "source_role": "official_directory",
    "regions": [
      "remote"
    ],
    "opportunity_types": [
      "course"
    ],
    "notes": "Free self-paced learning; link to specific high-school-relevant units.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "code-org",
    "name": "Code.org learning resources",
    "owner": "Code.org",
    "source_url": "https://code.org/student/learning",
    "source_role": "official_directory",
    "regions": [
      "remote"
    ],
    "opportunity_types": [
      "course",
      "activity"
    ],
    "notes": "Free coding lessons and activities; link to age-appropriate student-facing unit.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "cs50p",
    "name": "CS50's Introduction to Programming with Python",
    "owner": "Harvard University",
    "source_url": "https://pll.harvard.edu/course/cs50s-introduction-programming-python",
    "source_role": "official_program",
    "regions": [
      "remote"
    ],
    "opportunity_types": [
      "course"
    ],
    "notes": "Online, self-paced, free access option; introductory, designed for learners with or without prior Python experience.",
    "review_interval_days": 30,
    "status": "watch"
  },
  {
    "id": "cs50x",
    "name": "CS50's Introduction to Computer Science",
    "owner": "Harvard University",
    "source_url": "https://pll.harvard.edu/course/cs50-introduction-computer-science",
    "source_role": "official_program",
    "regions": [
      "remote"
    ],
    "opportunity_types": [
      "course"
    ],
    "notes": "Online course with a free access option; verify certificate pricing separately.",
    "review_interval_days": 30,
    "status": "watch"
  }
]
$sources$::jsonb) as x(
  id text, name text, owner text, source_url text, source_role text,
  regions text[], opportunity_types text[], notes text, review_interval_days smallint, status text
)
on conflict (id) do nothing;
