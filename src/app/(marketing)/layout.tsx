import Link from "next/link";
import { Logo } from "@/components/Logo";
import { Footer } from "@/components/Footer";
import { button } from "@/components/ui";

export default function MarketingLayout({ children }: LayoutProps<"/">) {
  return (
    <>
      <header className="mx-auto flex w-full max-w-5xl items-center justify-between px-5 py-5">
        <Logo />
        <Link href="/start" className={button("ghost")}>Sign in</Link>
      </header>
      <main id="main" className="flex-1">{children}</main>
      <Footer />
    </>
  );
}
