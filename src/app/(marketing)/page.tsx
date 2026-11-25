import Link from "next/link";
import { TrackEvent } from "@/components/Track";
import { listPublicCatalog } from "@/lib/public-catalog";

export const dynamic = "force-dynamic";
export const metadata = { title: { absolute: "OpportunityOS — Find your next opportunity" } };

export default async function Landing({ searchParams }: PageProps<"/">) {
  const { deleted } = await searchParams;
  const catalog = await listPublicCatalog();
  const examples = ["research", "competition", "volunteering"].flatMap(type => {
    const match = catalog.find(item => item.opportunity_type === type);
    return match ? [match] : [];
  });
  const preview = [...examples, ...catalog.filter(item => !examples.includes(item))].slice(0, 3);
  return (
    <div className="mx-auto max-w-5xl px-5 pb-16">
      <TrackEvent name="landing_page_view" />
      {deleted && <p role="status" className="mt-5">Your account and data have been deleted.</p>}
      <section className="max-w-2xl py-12 sm:py-20">
        <h1 className="font-serif text-5xl leading-tight tracking-tight sm:text-7xl">Find your next opportunity.</h1>
        <p className="mt-4 max-w-lg text-lg leading-relaxed text-stone-700">Get a shortlist of programs and experiences that fit your interests, grade, and availability.</p>
        <Link href="/start?next=/dashboard" className="mt-6 inline-flex rounded-lg bg-[#641426] px-5 py-3 font-semibold text-white hover:bg-[#4c1020]">Sign in to see my matches</Link>
      </section>
      {preview.length > 0 && <section aria-labelledby="examples" className="border-t border-stone-200 pt-6">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 id="examples" className="text-xl font-semibold">A few opportunities to explore</h2>
          <Link href="/browse" className="text-sm underline underline-offset-4">Browse all</Link>
        </div>
        <ul className="mt-5 grid gap-3 sm:grid-cols-3">
          {preview.map(item => <li key={item.id}>
            <a href={item.application_url} className="block h-full rounded-xl border border-stone-200 p-5 hover:border-[#641426]">
              <span className="text-sm text-stone-600">{item.organization}</span>
              <h3 className="mt-2 font-semibold leading-snug">{item.title}</h3>
            </a>
          </li>)}
        </ul>
      </section>}
    </div>
  );
}
