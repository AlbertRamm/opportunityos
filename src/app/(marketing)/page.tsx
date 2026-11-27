import { FeaturedRow } from "./featured-row";
import Link from "next/link";
import { TrackEvent } from "@/components/Track";
import { formatPublicCost, listPublicCatalog } from "@/lib/public-catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "OpportunityOS — Find your next opportunity" } };

export default async function Landing({ searchParams }: PageProps<"/">) {
  const { deleted } = await searchParams;
  const catalog = await listPublicCatalog();
  const picks = [
    ["Sports Journalism Summer Camp", "Report on sports with working journalists"],
    ["Aspiring Scientists Summer Internship Program (ASSIP)", "Work one-on-one with a researcher"],
    ["YouthWorks Summer Jobs", "Earn a paycheck with a Baltimore employer"],
    ["StudentCam Documentary Competition", "Make a documentary about a civic issue"],
    ["Bernard/Ebb Young Songwriter Awards", "Enter an original song"],
    ["National Investment Challenge", "Build and defend an investment strategy"],
    ["Weekend Adoption Event Dog Handler", "Help a rescue dog meet potential adopters"],
    ["Gaithersburg Summer High School Internship Program", "Spend the summer in a research lab"],
    ["Geographical Sciences High School Internship", "Map a changing planet from home"],
    ["UPWARDS TechTrek", "Build circuits and robots in Alexandria"],
  ];
  const featured = picks.flatMap(([title, headline]) => {
    const item = catalog.find(listing => listing.title === title);
    return item ? [{ item, headline }] : [];
  });
  const selected = new Set(featured.map(({ item }) => item.id));
  const preview = [...featured, ...catalog.filter(item => !selected.has(item.id)).map(item => ({ item, headline: item.title }))].slice(0, 5);
  const spotlight = catalog.find(item => item.title === "Virginia Earth System Science Scholars");
  return (
    <div className="mx-auto max-w-5xl px-5 pb-16">
      <TrackEvent name="landing_page_view" />
      {deleted && <p role="status" className="mt-5">Your account and data have been deleted.</p>}
      <section className="grid items-center gap-7 py-8 sm:py-12 md:grid-cols-2 md:gap-10">
        <div>
          <h1 className="text-balance font-serif text-5xl leading-[1.03] tracking-tight sm:text-6xl">What would you like to try?</h1>
          <p className="mt-4 max-w-md text-lg leading-relaxed text-stone-700">Find hands-on programs, paid work, and online opportunities for high school students in DC, Maryland, and Virginia.</p>
          <Link href="/start?next=/dashboard" className="mt-6 inline-flex min-h-12 items-center rounded-full bg-[#861d38] px-6 font-semibold text-white hover:bg-[#641426]">Sign in to find my matches <span aria-hidden="true" className="ml-3">→</span></Link>
          <p className="mt-3 text-sm text-stone-600">Your grade, interests, and schedule shape your list.</p>
        </div>
        {spotlight && <a href={spotlight.application_url} className="group relative isolate flex min-h-64 flex-col justify-end overflow-hidden rounded-3xl bg-[#29141d] p-6 text-white sm:min-h-80">
          <div aria-hidden="true" className="absolute inset-0 -z-10 bg-[radial-gradient(ellipse_at_top_right,#526d85_0%,#243447_34%,#29141d_74%)]" />
          <span className="text-sm font-semibold">Virginia Space Grant Consortium</span>
          <h2 className="mt-2 max-w-xs font-serif text-4xl leading-tight">Study Earth from space.</h2>
          <p className="mt-2 max-w-sm text-sm leading-relaxed">Virginia juniors and seniors explore climate and satellite data online.</p>
          <span className="mt-4 text-sm font-semibold underline underline-offset-4">Explore the scholars program ↗</span>
        </a>}
      </section>
      {preview.length > 0 && <section id="preview" aria-labelledby="examples" className="border-t border-stone-200 pt-6">
        <h2 id="examples" className="font-serif text-3xl tracking-tight">A few things you could do</h2>
        <FeaturedRow cards={preview.map(({ item, headline }) => ({
          id: item.id, headline, organization: item.organization, title: item.title, url: item.application_url,
          facts: [item.work_mode === "remote" ? "Online" : item.location_name, item.compensation_description, formatPublicCost(item)].filter(Boolean).join(" · "),
        }))} />
      </section>}
    </div>
  );
}
