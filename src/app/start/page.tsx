import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Logo } from "@/components/Logo";
import { SignInForm } from "@/components/SignInForm";
import { getUser } from "@/lib/data";
import { safeNext } from "@/lib/forms";

export const metadata: Metadata = { title: "Sign in" };

export default async function Start({ searchParams }: PageProps<"/start">) {
  const sp = await searchParams;
  const next = safeNext(typeof sp.next === "string" ? sp.next : null);
  const initialError = sp.error === "auth" ? "That sign-in link is invalid or expired. Request a new one." : undefined;
  if (await getUser()) redirect(next);
  return (
    <>
      <header className="mx-auto w-[calc(100%-2.5rem)] max-w-5xl border-b border-line py-4"><Logo /></header>
      <main id="main" className="mx-auto my-10 w-[calc(100%-2.5rem)] max-w-md self-start rounded-3xl border border-line bg-white p-6 shadow-sm sm:my-16 sm:p-9">
        <h1 className="text-3xl font-semibold tracking-tight">Welcome to OpportunityOS</h1>
        <p className="mb-8 mt-2 text-muted">Use your email to find your matches and keep the opportunities you like.</p>
        <SignInForm next={next} initialError={initialError} />
      </main>
    </>
  );
}
