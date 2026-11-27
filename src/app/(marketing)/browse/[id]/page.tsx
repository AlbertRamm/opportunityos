import Link from "next/link";
import { notFound } from "next/navigation";
import { gradeRange } from "../../browse-catalog";
import { formatDate } from "@/lib/dates";
import { safeHttpUrl } from "@/lib/opportunities";
import { formatPublicCost, getPublicListing } from "@/lib/public-catalog";

export const dynamic = "force-dynamic";

export default async function ProgramPage({ params }: PageProps<"/browse/[id]">) {
  const { id } = await params;
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) notFound();
  const listing = await getPublicListing(id);
  if (!listing) notFound();
  const officialUrl = safeHttpUrl(listing.source_url);

  return (
    <article className="mx-auto max-w-3xl space-y-5 px-5 py-10">
      <Link href="/browse" className="underline">All opportunities</Link>
      <h1 className="text-4xl font-bold">{listing.title}</h1>
      <p>{listing.organization}</p>
      <p>{listing.description}</p>
      <dl className="space-y-2">
        <div><dt className="font-semibold">Grades</dt><dd>{gradeRange(listing)}{listing.allowed_schools.length > 0 && " · School restrictions may apply"}</dd></div>
        <div><dt className="font-semibold">Location</dt><dd>{listing.work_mode === "remote" ? "Online" : listing.location_name ?? "Check the official page"}</dd></div>
        <div><dt className="font-semibold">Cost</dt><dd>{formatPublicCost(listing)}</dd></div>
        {listing.compensation_description && <div><dt className="font-semibold">Compensation</dt><dd>{listing.compensation_description}</dd></div>}
        <div><dt className="font-semibold">Deadline</dt><dd>{listing.application_deadline ? formatDate(listing.application_deadline) : "Check the official page"}</dd></div>
        <div><dt className="font-semibold">Last verified</dt><dd>{formatDate(listing.last_verified_at.slice(0, 10))}</dd></div>
      </dl>
      {officialUrl && <p><a href={officialUrl} className="underline">Official program information</a></p>}
      <Link href={`/start?next=${encodeURIComponent(`/opportunities/${listing.id}`)}`} className="underline">Sign in to check your eligibility and save</Link>
    </article>
  );
}
