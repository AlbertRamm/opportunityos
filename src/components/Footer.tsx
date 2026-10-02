import Link from "next/link";

export function Footer() {
  return (
    <footer className="mt-auto border-t border-line py-8 text-sm text-muted">
      <div className="mx-auto flex max-w-5xl flex-col gap-2 px-5 sm:flex-row sm:justify-between">
        <p>OpportunityOS helps you find opportunities. It can&apos;t guarantee eligibility, acceptance, scholarships, jobs, or admission — always confirm requirements on the official page.</p>
        <Link href="/privacy" className="underline underline-offset-4 shrink-0">Privacy</Link>
      </div>
    </footer>
  );
}
