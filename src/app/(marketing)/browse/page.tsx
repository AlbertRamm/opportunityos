import { redirect } from "next/navigation";
import { getUser } from "@/lib/data";
import { BrowseCatalog } from "../browse-catalog";
import { listPublicCatalog } from "@/lib/public-catalog";

export const dynamic = "force-dynamic";

export const metadata = { title: "Browse opportunities" };

export default async function BrowsePage({ searchParams }: PageProps<"/browse">) {
  if (!(await getUser())) redirect("/");
  const listings = await listPublicCatalog();
  return (
    <div className="mx-auto max-w-5xl px-5 pb-12 pt-8 sm:pt-12">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Explore opportunities</h1>
      <BrowseCatalog filters={await searchParams} listings={listings} />
    </div>
  );
}
