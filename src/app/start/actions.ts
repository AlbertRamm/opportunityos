"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext, str, type FormState } from "@/lib/forms";
import { requireEnv } from "@/lib/config";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type SignInState = FormState & { step?: "email" | "sent"; email?: string };

export async function signIn(_prev: SignInState, fd: FormData): Promise<SignInState> {
  const intent = str(fd, "intent");
  const supabase = await createClient();

  if (intent !== "send") return { step: "email" };

  const email = str(fd, "email").toLowerCase();
  if (!EMAIL.test(email)) return { step: "email", error: "Enter a valid email address.", email };
  if (fd.get("age13") !== "on") {
    return { step: "email", email, error: "OpportunityOS is for students 13 and older. Please confirm to continue." };
  }

  const callback = new URL("/auth/callback", requireEnv("NEXT_PUBLIC_SITE_URL"));
  callback.searchParams.set("next", safeNext(str(fd, "next")));
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { shouldCreateUser: true, emailRedirectTo: callback.toString() },
  });
  if (error) {
    console.error("[auth] signInWithOtp", error.message);
    const limited = /rate|seconds|limit/i.test(error.message);
    return {
      step: "email",
      email,
      error: limited
        ? "Too many email attempts. Please wait up to an hour before trying again."
        : "We couldn't send the sign-in link. Check the address and try again.",
    };
  }
  return { step: "sent", email };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
