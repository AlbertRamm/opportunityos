import Link from "next/link";
import { requireAdmin } from "@/lib/data";
import { Logo } from "@/components/Logo";

const link = "rounded-full px-3.5 py-2 text-sm font-medium hover:bg-black/5 min-h-11 inline-flex items-center";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  await requireAdmin();
  return (
    <>
      <header className="border-b border-line bg-ink text-white">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-3 px-5 py-2.5">
          <div className="flex items-center gap-3">
            <Logo href="/admin" />
            <span className="rounded bg-white/15 px-2 py-0.5 text-xs font-semibold uppercase tracking-wider">Admin</span>
          </div>
          <nav aria-label="Admin" className="flex flex-wrap gap-1 [&_a]:hover:bg-white/10">
            <Link className={link} href="/admin">Opportunities</Link>
            <Link className={link} href="/admin/opportunities/new">New</Link>
            <Link className={link} href="/admin/import">Import from URL</Link>
            <Link className={link} href="/admin/analytics">Analytics</Link>
            <Link className={link} href="/dashboard">Student view ↗</Link>
          </nav>
        </div>
      </header>
      <main id="main" className="mx-auto w-full max-w-6xl flex-1 px-5 pb-20 pt-8">{children}</main>
    </>
  );
}
