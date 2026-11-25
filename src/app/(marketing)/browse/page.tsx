import { BrowseCatalog } from "../browse-catalog";

export const metadata = { title: "Browse opportunities" };

export default async function BrowsePage({ searchParams }: PageProps<"/browse">) {
  return (
    <div className="mx-auto max-w-5xl px-5 pb-12 pt-8 sm:pt-12">
      <h1 className="text-4xl font-bold tracking-tight sm:text-6xl">Explore opportunities</h1>
      <BrowseCatalog filters={await searchParams} />
    </div>
  );
}
