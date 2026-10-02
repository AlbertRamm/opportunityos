import type { Metadata } from "next";
import Link from "next/link";
import { button, card, hint, input, label } from "@/components/ui";
import { getExtractor } from "@/lib/extraction";
import { safeHttpUrl } from "@/lib/opportunities";

export const metadata: Metadata = { title: "Admin · Import from URL" };

export default async function ImportPage({ searchParams }: PageProps<"/admin/import">) {
  const sp = await searchParams;
  const raw = typeof sp.url === "string" ? sp.url : "";
  const url = safeHttpUrl(raw);
  const extractor = getExtractor();
  const result = url ? await extractor.extract(url) : null;

  return (
    <>
      <div className="flex items-center gap-3">
        <h1 className="text-3xl font-semibold tracking-tight">Import from URL</h1>
        <span className="rounded bg-amber-100 px-2 py-1 text-xs font-semibold uppercase tracking-wider text-amber-900">Experimental</span>
      </div>
      <p className="mt-3 max-w-2xl text-muted">
        Future: paste an opportunity page and an AI service <em>proposes</em> structured fields. A human reviews and verifies them, and only then does the rule-based matching engine use them. The AI never decides eligibility.
      </p>

      <form method="get" className={`${card} mt-8 max-w-2xl space-y-4 p-6`}>
        <div>
          <label htmlFor="url" className={label}>Opportunity page URL</label>
          <input id="url" name="url" type="url" required defaultValue={raw} placeholder="https://…" className={input} />
          <p className={hint}>Extractor in use: <code>{extractor.name}</code></p>
        </div>
        <button className={button("primary")}>Propose fields</button>
      </form>

      {raw && !url && <p role="alert" className="mt-6 text-red-700">That isn&apos;t a valid http(s) URL.</p>}
      {result && url && (
        <section className={`${card} mt-6 max-w-2xl p-6`} aria-live="polite">
          {result.status === "not_configured" && (
            <>
              <h2 className="font-semibold">No extraction available</h2>
              <p className="mt-2 text-sm text-muted">{result.reason}</p>
              <Link href={`/admin/opportunities/new?source_url=${encodeURIComponent(url)}`} className={button("accent") + " mt-5"}>
                Start a new opportunity with this URL pre-filled
              </Link>
            </>
          )}
          {result.status === "failed" && <p className="text-red-700">Extraction failed: {result.reason}</p>}
          {result.status === "proposed" && <pre className="overflow-auto text-xs">{JSON.stringify(result.fields, null, 2)}</pre>}
        </section>
      )}
    </>
  );
}
