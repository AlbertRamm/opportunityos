"use client";

export default function MarketingError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-20" role="alert">
      <h1 className="font-serif text-3xl">Opportunities are temporarily unavailable</h1>
      <p className="mt-3 text-stone-700">We couldn&apos;t load the directory. Try again in a moment.</p>
      <button type="button" onClick={reset} className="mt-6 min-h-11 rounded-full bg-[#861d38] px-5 font-semibold text-white">Try again</button>
    </main>
  );
}
