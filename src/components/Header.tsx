import Link from "next/link";
import { signOut } from "@/app/start/actions";
import { isAdmin } from "@/lib/data";
import { Logo } from "./Logo";

const nav = "rounded-full px-3.5 py-2 text-sm font-medium hover:bg-black/5 min-h-11 inline-flex items-center";

export async function Header({ active }: { active?: "dashboard" | "saved" | "profile" }) {
  const admin = await isAdmin();
  const cur = (k: string) => (active === k ? "bg-black/5" : "");
  return (
    <header className="border-b border-line bg-paper/90 backdrop-blur">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-between gap-x-4 px-5 py-2.5">
        <Logo href="/dashboard" />
        <nav aria-label="Main" className="flex flex-wrap items-center gap-1">
          <Link href="/dashboard" className={`${nav} ${cur("dashboard")}`} aria-current={active === "dashboard" ? "page" : undefined}>Opportunities</Link>
          <Link href="/saved" className={`${nav} ${cur("saved")}`} aria-current={active === "saved" ? "page" : undefined}>Saved</Link>
          <Link href="/profile" className={`${nav} ${cur("profile")}`} aria-current={active === "profile" ? "page" : undefined}>Profile</Link>
          {admin && <Link href="/admin" className={nav}>Admin</Link>}
          <form action={signOut}><button className={nav}>Sign out</button></form>
        </nav>
      </div>
    </header>
  );
}
