"use client";

export default function StudentError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto max-w-3xl px-5 py-20" role="alert">
      <h1 className="text-3xl font-semibold">We couldn&apos;t load your opportunities</h1>
      <p className="mt-3 text-muted">Your saved items and match results are still here. Try loading them again.</p>
      <button type="button" onClick={reset} className="mt-6 min-h-11 rounded-full bg-ink px-5 font-semibold text-white">Try again</button>
    </main>
  );
}
