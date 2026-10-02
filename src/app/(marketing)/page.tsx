import Link from "next/link";
import { button } from "@/components/ui";
import { TrackEvent } from "@/components/Track";

const STEPS = [
  { n: "1", title: "Tell us about yourself", body: "A two-minute profile: grade, age, ZIP code, interests, and what you’re looking for. Once." },
  { n: "2", title: "We check eligibility", body: "Every opportunity has written requirements. We compare them to your profile with fixed rules — no guessing." },
  { n: "3", title: "Get matched", body: "See what you qualify for, and exactly why. If we can’t tell something, we say so instead of pretending." },
  { n: "4", title: "Never miss a deadline", body: "Save what you like and see what’s closing soon. You apply on the organization’s official site." },
];

export default async function Landing({ searchParams }: PageProps<"/">) {
  const sp = await searchParams;
  return (
    <>
      <TrackEvent name="landing_page_view" />
      <section className="mx-auto max-w-5xl px-5 pb-16 pt-12 sm:pt-20">
        {sp.deleted && (
          <p role="status" className="mb-8 rounded-lg border border-line bg-surface px-4 py-3 text-sm">Your account and data have been deleted.</p>
        )}
        <h1 className="fade-in max-w-3xl text-5xl font-semibold leading-[1.05] tracking-tight sm:text-7xl">
          Stop searching.<br />Start applying.
        </h1>
        <p className="mt-6 max-w-xl text-lg text-muted sm:text-xl">
          OpportunityOS finds the internships, scholarships, programs, and other opportunities you actually qualify for — for high-school students in DC, Maryland, and Northern Virginia.
        </p>
        <div className="mt-9 flex flex-wrap items-center gap-4">
          <Link href="/start" className={button("accent") + " px-7 py-3.5 text-base"}>Find my opportunities</Link>
          <span className="text-sm text-muted">Free · No password · About 2 minutes</span>
        </div>
      </section>

      <section aria-labelledby="how" className="border-t border-line bg-surface">
        <div className="mx-auto max-w-5xl px-5 py-16">
          <h2 id="how" className="text-sm font-semibold uppercase tracking-widest text-muted">How it works</h2>
          <ol className="mt-8 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
            {STEPS.map((s) => (
              <li key={s.n}>
                <div className="mb-3 flex h-9 w-9 items-center justify-center rounded-full bg-accent-soft text-sm font-semibold text-accent" aria-hidden>{s.n}</div>
                <h3 className="font-semibold">{s.title}</h3>
                <p className="mt-1.5 text-sm text-muted">{s.body}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-5 py-16">
        <h2 className="text-2xl font-semibold tracking-tight">Honest by design</h2>
        <p className="mt-3 max-w-2xl text-muted">
          Opportunities are checked by a person before you see them, and your matches come from clear rules, not an AI’s guess. Each result says why it fits — and flags anything we couldn’t confirm so you can check the official page. We never collect your home address.
        </p>
        <Link href="/privacy" className="mt-4 inline-block text-sm underline underline-offset-4">How we handle your information</Link>
      </section>
    </>
  );
}
