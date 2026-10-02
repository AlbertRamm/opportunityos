"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { safeNext, str, type FormState } from "@/lib/forms";

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export type SignInState = FormState & { step?: "email" | "code"; email?: string };

export async function signIn(_prev: SignInState, fd: FormData): Promise<SignInState> {
  const intent = str(fd, "intent");
  const supabase = await createClient();

  if (intent === "send") {
    const email = str(fd, "email").toLowerCase();
    if (!EMAIL.test(email)) return { step: "email", error: "Enter a valid email address.", email };
    if (fd.get("age13") !== "on") {
      return { step: "email", email, error: "OpportunityOS is for students 13 and older. Please confirm to continue." };
    }
    const { error } = await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: true } });
    if (error) {
      console.error("[auth] signInWithOtp", error.message);
      const limited = /rate|seconds|limit/i.test(error.message);
      return {
        step: "email",
        email,
        error: limited
          ? "Too many attempts. Wait a minute and try again."
          : "We couldn't send the code. Check the address and try again.",
      };
    }
    return { step: "code", email };
  }

  if (intent === "verify") {
    const email = str(fd, "email").toLowerCase();
    const token = str(fd, "code").replace(/\s/g, "");
    if (!/^\d{6,10}$/.test(token)) return { step: "code", email, error: "Enter the numeric code from your email." };
    const { error } = await supabase.auth.verifyOtp({ email, token, type: "email" });
    if (error) return { step: "code", email, error: "That code didn't work. It may have expired — go back and request a new one." };
    redirect(safeNext(str(fd, "next")));
  }

  return { step: "email" };
}

export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}
