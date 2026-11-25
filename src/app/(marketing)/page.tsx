import { FeaturedRow } from "./featured-row";
import Link from "next/link";
import { TrackEvent } from "@/components/Track";
import { listPublicCatalog } from "@/lib/public-catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "OpportunityOS — Find your next opportunity" } };

export default async function Landing({ searchParams }: PageProps<"/">) {
  const { deleted } = await searchParams;
  const catalog = await listPublicCatalog();
  const picks = [
    ["Aspiring Scientists Summer Internship Program (ASSIP)", "Work one-on-one with a researcher"],
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
  const preview = [...featured, ...catalog.filter(item => !selected.has(item.id)).map(item => ({ item, headline: item.title }))].slice(0, 8);
  return (
    <div className="mx-auto max-w-5xl px-5 pb-16">
      <TrackEvent name="landing_page_view" />
      {deleted && <p role="status" className="mt-5">Your account and data have been deleted.</p>}
      <section className="max-w-2xl py-12 sm:py-20">
        <h1 className="font-serif text-5xl leading-tight tracking-tight sm:text-7xl">Find your next opportunity.</h1>
        <p className="mt-4 max-w-lg text-lg leading-relaxed text-stone-700">Explore experiences in DC, Maryland, Virginia, and online. Sign in for ideas that fit your interests and schedule.</p>
        <Link href="/start?next=/dashboard" className="mt-6 inline-flex rounded-lg bg-[#641426] px-5 py-3 font-semibold text-white hover:bg-[#4c1020]">Sign in to see my matches</Link>
      </section>
      {preview.length > 0 && <section aria-labelledby="examples" className="border-t border-stone-200 pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="examples" className="text-xl font-semibold">Featured opportunities</h2>
          <Link href="/browse" className="text-sm underline underline-offset-4">Browse all</Link>
        </div>
        <FeaturedRow cards={preview.map(({ item, headline }) => ({
          id: item.id, headline, organization: item.organization, title: item.title, url: item.application_url,
          facts: [item.work_mode === "remote" ? "Online" : item.location_name, item.compensation_description].filter(Boolean).join(" · "),
        }))} />
      </section>}
    </div>
  );
}
