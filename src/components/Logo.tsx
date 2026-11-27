import Link from "next/link";

export function Logo({ href = "/", light = false }: { href?: string; light?: boolean }) {
  return (
    <Link href={href} className={`font-serif text-2xl font-bold tracking-tight ${light ? "text-white" : "text-[#641426]"}`}>
      OpportunityOS
    </Link>
  );
}
