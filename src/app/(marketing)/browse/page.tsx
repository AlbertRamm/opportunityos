import Link from "next/link";
import { BrowseCatalog } from "../browse-catalog";
import { listPublicCatalog } from "@/lib/public-catalog";

export const dynamic = "force-dynamic";

export const metadata = { title: "Browse opportunities" };

export default async function BrowsePage({ searchParams }: PageProps<"/browse">) {
  const listings = await listPublicCatalog();
  return (
    <div className="mx-auto max-w-5xl px-5 pb-12 pt-8 sm:pt-12">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Explore opportunities</h1>
      <Link href="/start?next=/dashboard" className="my-5 inline-flex rounded-lg bg-[#641426] px-5 py-3 font-semibold text-white">Sign in to see my matches</Link>
      <BrowseCatalog filters={await searchParams} listings={listings} />
    </div>
  );
}
