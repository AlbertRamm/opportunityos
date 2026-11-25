import Link from "next/link";
import { formatDate, todayET } from "@/lib/dates";
import type { PublicCatalogListing } from "@/lib/public-catalog";

type Filters = Record<string, string | string[] | undefined>;

const timing = [
  { value: "summer", label: "Summer" },
  { value: "school_year", label: "School year" },
];
const types = [
  { value: "internship", label: "Internships" },
  { value: "volunteering", label: "Volunteering" },
  { value: "summer_program", label: "Programs" },
  { value: "course", label: "Courses / learning" },
  { value: "job", label: "Jobs" },
  { value: "research", label: "Research" },
  { value: "competition", label: "Competitions" },
  { value: "activity", label: "Activities" },
  { value: "course", label: "Courses" },
];

function season(listing: PublicCatalogListing) {
  return listing.schedule_period ?? (listing.opportunity_type === "summer_program" ? "summer" : undefined);
}

function gradeRange({ min_grade, max_grade }: PublicCatalogListing) {
  if (min_grade && max_grade) {
    return min_grade === max_grade ? `Grade ${min_grade}` : `Grades ${min_grade}–${max_grade}`;
  }
  if (min_grade) return `Grade ${min_grade} and up`;
  if (max_grade) return `Through grade ${max_grade}`;
  return "Check grade requirements";
}

function FilterGroup({ name, label, options, selected }: {
  name: string;
  label: string;
  options: { value: string; label: string }[];
  selected: readonly string[];
}) {
  return (
    <fieldset className="flex flex-wrap items-center gap-2">
      <legend className="mb-2 text-sm font-bold">{label}</legend>
      {options.map(({ value, label }) => (
        <label key={value} className="cursor-pointer">
          <input type="checkbox" className="peer sr-only" name={name} value={value} defaultChecked={selected.includes(value)} />
          <span className="inline-flex min-h-10 items-center rounded-md border border-[#641426] px-3 text-sm font-semibold peer-checked:bg-[#641426] peer-checked:text-white peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-[#641426] hover:underline">
            {label}
          </span>
        </label>
      ))}
    </fieldset>
  );
}

export function BrowseCatalog({ filters, listings: catalog, preview = false }: { filters: Filters; listings: readonly PublicCatalogListing[]; preview?: boolean }) {
  const selectedTiming = [filters.when ?? []].flat().filter((value) => timing.some((item) => item.value === value));
  const selectedTypes = [filters.type ?? []].flat().filter((value) => types.some((item) => item.value === value));
  const today = todayET();
  const listings = catalog.filter((listing) => {
    if (!types.some(({ value }) => value === listing.opportunity_type)) return false;
    if (preview && (!listing.application_deadline || listing.application_deadline < today)) return false;
    const period = season(listing);
    return (!selectedTiming.length || period === "both" || period === "flexible" || (period && selectedTiming.includes(period))) &&
      (!selectedTypes.length || selectedTypes.includes(listing.opportunity_type));
  }).sort((a, b) => {
    const rank = (deadline?: string) => !deadline ? 1 : deadline < today ? 2 : 0;
    return rank(a.application_deadline) - rank(b.application_deadline) ||
      (a.application_deadline ?? "").localeCompare(b.application_deadline ?? "");
  });

  return (
    <>
      <form action="/browse" method="get" className="my-5 space-y-4">
        <FilterGroup name="when" label="When" options={timing} selected={selectedTiming} />
        <FilterGroup name="type" label="Type" options={types} selected={selectedTypes} />
        <div className="flex items-center gap-4">
          <button className="min-h-10 rounded-md bg-[#641426] px-4 text-sm font-semibold text-white hover:underline">Apply filters</button>
          {(selectedTiming.length > 0 || selectedTypes.length > 0) && <Link href="/browse" className="text-sm underline">Clear filters</Link>}
        </div>
      </form>
      <p className="mb-2 text-sm">{preview ? "Upcoming deadlines" : `${listings.length} ${listings.length === 1 ? "opportunity" : "opportunities"}`}</p>
      {listings.length === 0 ? (
        <p className="border-t border-current pt-4 text-sm">{preview ? "We are refreshing listings against official program pages. Check back as current-cycle opportunities are verified." : "No current, recently verified opportunities match these filters. We refresh this directory from official program pages; check back soon or clear a filter."}</p>
      ) : (
        <ul className="border-t border-[#641426]/40">
          {(preview ? listings.slice(0, 3) : listings).map((listing) => {
            const deadline = listing.application_deadline;
            const metadata = [timing.find(({ value }) => value === season(listing))?.label,
              types.find(({ value }) => value === listing.opportunity_type)?.label, gradeRange(listing)];
            if (deadline) metadata.push(`${deadline < today ? "Past deadline" : "Listed deadline"}: ${formatDate(deadline)}`);
            return (
              <li key={listing.title} className="border-b border-[#641426]/40 py-4">
                <h3 className="text-lg font-bold tracking-tight sm:text-xl">
                  <a href={listing.application_url} className="hover:underline">{listing.title} <span aria-hidden="true">→</span></a>
                </h3>
                <p className="mt-1 text-sm">{[listing.organization, ...metadata, `Checked ${formatDate(listing.last_verified_at.slice(0, 10))}`].filter(Boolean).join(" · ")}</p>
                {!preview && <><p className="mt-2 max-w-3xl text-sm">{listing.description}</p><p className="mt-2 text-sm"><a className="underline" href={listing.source_url}>Official source</a></p></>}
              </li>
            );
          })}
        </ul>
      )}
    </>
  );
}
