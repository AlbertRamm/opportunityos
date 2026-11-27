import Link from "next/link";
import { Footer } from "@/components/Footer";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <div className="flex flex-1 flex-col bg-white text-[#641426]">
      <header className="mx-auto w-[calc(100%-2.5rem)] max-w-5xl border-b border-line">
        <div className="flex flex-wrap items-center justify-between gap-x-5 gap-y-2 py-3">
          <Link href="/" className="font-serif text-2xl font-bold tracking-tight sm:text-3xl">OpportunityOS</Link>
          <nav aria-label="Main" className="flex gap-3 text-sm font-medium sm:gap-7">
            <Link href="/browse" className="py-2 hover:underline">Explore</Link>

            <Link href="/start" className="py-2 hover:underline">Sign in</Link>
          </nav>
        </div>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <Footer />
    </div>
  );
}
