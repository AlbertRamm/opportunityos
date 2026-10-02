import Link from "next/link";
import { button } from "@/components/ui";

export default function NotFound() {
  return (
    <main id="main" className="mx-auto w-full max-w-md flex-1 px-5 pt-24 text-center">
      <h1 className="text-2xl font-semibold">This opportunity isn&apos;t available</h1>
      <p className="mt-2 text-muted">It may have been removed or archived while we re-verify it.</p>
      <Link href="/dashboard" className={button("primary") + " mt-6"}>Back to opportunities</Link>
    </main>
  );
}
