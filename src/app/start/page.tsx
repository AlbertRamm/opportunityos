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
  if (await getUser()) redirect(next);
  return (
    <>
      <header className="mx-auto w-full max-w-5xl px-5 py-5"><Logo /></header>
      <main id="main" className="mx-auto w-full max-w-md flex-1 px-5 pt-8 sm:pt-16">
        <h1 className="text-3xl font-semibold tracking-tight">Let&apos;s find your opportunities</h1>
        <p className="mb-8 mt-2 text-muted">Sign in or create your account with your email.</p>
        <SignInForm next={next} />
      </main>
    </>
  );
}
