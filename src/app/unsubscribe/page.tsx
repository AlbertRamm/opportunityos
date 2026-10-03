import type { Metadata } from "next";
import Link from "next/link";
import { Logo } from "@/components/Logo";
import { UnsubscribeForm } from "@/components/UnsubscribeForm";
import { verifyUnsubscribeToken } from "@/lib/reminders";

export const metadata: Metadata = { title: "Deadline reminders", robots: { index: false } };

export default async function Unsubscribe({ searchParams }: PageProps<"/unsubscribe">) {
  const sp = await searchParams;
  const token = typeof sp.t === "string" ? sp.t : "";
  const secret = process.env.CRON_SECRET;
  const valid = !!secret && !!verifyUnsubscribeToken(token, process.env.UNSUBSCRIBE_SECRET || secret);
  return (
    <>
      <header className="mx-auto w-full max-w-5xl px-5 py-5"><Logo /></header>
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-5 pt-10">
        <h1 className="text-2xl font-semibold tracking-tight">Deadline reminders</h1>
        {valid ? (
          <div className="mt-6">
            <p className="mb-5 text-muted">We email you 7 and 2 days before the deadline of opportunities you&apos;ve saved. Turn that off?</p>
            <UnsubscribeForm token={token} />
          </div>
        ) : (
          <p className="mt-6 text-muted">This link isn&apos;t valid or has expired. <Link href="/profile" className="underline underline-offset-4">Sign in and manage reminders on your Profile page.</Link></p>
        )}
      </main>
    </>
  );
}
