import type { Metadata } from "next";

export const metadata: Metadata = { title: "Privacy" };
// Dynamic so every response gets a fresh CSP nonce (static HTML can't carry one).
export const dynamic = "force-dynamic";

export default function Privacy() {
  return (
    <article className="mx-auto max-w-2xl px-5 py-12">
      <h1 className="text-3xl font-semibold tracking-tight">Privacy, in plain language</h1>
      <p className="mt-2 text-sm text-muted">Early-stage product. This is a plain-language summary, not a legal contract.</p>
      <div className="mt-8 space-y-8 text-[15px] leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold">What we collect</h2>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>Your email address (to sign you in with a one-time code — no password).</li>
            <li>First name, birth date, grade, expected graduation year, ZIP code, state, and school name.</li>
            <li>Your interests and what kinds of opportunities you want.</li>
            <li>
              <strong>Optional &ldquo;Match details&rdquo;</strong>, only if you choose to answer: your GPA (with its scale and whether it&apos;s weighted), whether you think you&apos;d qualify for need-based scholarships,
              a yes/no/not-sure answer to &ldquo;I meet U.S. citizenship or permanent-residency requirements commonly used by scholarships,&rdquo; and whether you plan to attend a four-year or two-year college. We use them only to check eligibility rules for you.
              They are never shown to programs, scholarship providers, or advertisers, and you can change or clear them any time on your Profile page.
            </li>
            <li>What you save, which application links you open, and any status you choose to report (like “Applied”).</li>
            <li>Basic usage events (for example, that you viewed an opportunity) so we can tell whether the product is useful.</li>
            <li>If you tap “Not a good match?”, the reason you pick from a list (we don&apos;t collect typed comments).</li>
          </ul>
        </section>
        <section>
          <h2 className="text-lg font-semibold">What we don’t collect</h2>
          <p className="mt-2">Your street address, Social Security number, family income or other financial information, your actual citizenship or immigration status (the optional Match details question is only a coarse yes/no about meeting a common scholarship rule), race, or other demographic details. We use your ZIP code only to check location rules and to estimate a rough distance (we store an approximate point, accurate to about a kilometer).</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Why we collect it</h2>
          <p className="mt-2">Only to match you with opportunities you’re eligible for and to improve OpportunityOS. We don’t sell your information and we don’t show ads. Your profile is private: only you can see it, and the team sees usage only as aggregate totals.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Deadline reminder emails</h2>
          <p className="mt-2">If you save an opportunity, we email you once at 7 days and once at 2 days before its deadline (never if you&apos;ve marked it applied or no longer interested, and never for listings we&apos;ve removed). They&apos;re on by default; every email has a one-click link to turn them off, and you can change this on your Profile page. We only email you about your own saved opportunities and sign-in links — no newsletters or ads.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Clicking “Apply”</h2>
          <p className="mt-2">Applications happen on each organization’s own website, under their rules and privacy policy. We note that you opened the link — we do not know whether you applied unless you tell us.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Age</h2>
          <p className="mt-2">OpportunityOS is for students 13 and older.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">Deleting your data</h2>
          <p className="mt-2">You can permanently delete your account and all associated data any time from your Profile page.</p>
        </section>
        <section>
          <h2 className="text-lg font-semibold">No guarantees</h2>
          <p className="mt-2">We do our best to keep listings accurate, but requirements change. OpportunityOS does not guarantee eligibility, acceptance, scholarships, employment, or admission. Always confirm details on the official page before applying.</p>
        </section>
      </div>
    </article>
  );
}
