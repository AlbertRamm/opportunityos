import Link from "next/link";
import { TrackEvent } from "@/components/Track";
import { BrowseCatalog } from "./browse-catalog";
import { listPublicCatalog } from "@/lib/public-catalog";

export const dynamic = "force-dynamic";

export const metadata = {
  title: { absolute: "OpportunityOS — Find your next opportunity" },
  description: "Find programs, internships, and ways to get involved during high school in the DC area.",
};

export default async function Landing({ searchParams }: PageProps<"/">) {
  const filters = await searchParams;
  const listings = await listPublicCatalog();
  return (
    <div className="mx-auto max-w-5xl px-5">
      <TrackEvent name="landing_page_view" />
      <section className="pb-9 pt-9 sm:pb-12 sm:pt-14">
        {filters.deleted && (
          <p role="status" className="mb-6 border border-current px-4 py-3 text-sm">Your account and data have been deleted.</p>
        )}
        <h1 className="text-[clamp(2.8rem,8vw,6rem)] font-bold leading-[0.98] tracking-[-0.065em]">
          Find your next<br />opportunity.
        </h1>
        <p className="mt-5 max-w-xl text-lg sm:text-xl">
          Find programs, internships, and ways to get involved during high school.
        </p>
        <Link href="/browse" className="mt-6 inline-flex rounded-md bg-[#641426] px-5 py-3 font-semibold text-white hover:underline">
          Browse opportunities
        </Link>
      </section>
      <section aria-labelledby="explore" className="border-t border-current pb-12 pt-5">
        <h2 id="explore" className="text-2xl font-bold tracking-tight sm:text-3xl">Explore opportunities</h2>
        <BrowseCatalog filters={filters} listings={listings} preview />
      </section>
    </div>
  );
}
