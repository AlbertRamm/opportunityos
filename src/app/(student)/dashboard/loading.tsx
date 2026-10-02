export default function Loading() {
  return (
    <main className="mx-auto w-full max-w-5xl flex-1 px-5 pt-20" aria-busy="true">
      <p className="sr-only" role="status">Loading your opportunities…</p>
      <div className="h-9 w-64 animate-pulse rounded bg-black/10" />
      <div className="mt-8 grid gap-4 lg:grid-cols-2">
        {[0, 1, 2, 3].map((i) => <div key={i} className="h-56 animate-pulse rounded-2xl bg-black/5" />)}
      </div>
    </main>
  );
}
