import Link from "next/link";

export function Logo({ href = "/" }: { href?: string }) {
  return (
    <Link href={href} className="font-serif text-2xl font-bold tracking-tight text-[#641426]">
      OpportunityOS
    </Link>
  );
}
