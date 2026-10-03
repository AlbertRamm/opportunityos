"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/app/start/actions";
import { button, hint, input, label } from "./ui";

export function SignInForm({ next, initialError }: { next: string; initialError?: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { step: "email" });

  if (state.step === "sent") {
    return (
      <div className="space-y-5">
        <p className="text-muted">We emailed a secure sign-in link to <strong className="text-ink">{state.email}</strong>. Click it to continue. It can take a minute — check spam too.</p>
        <a href={`/start?next=${encodeURIComponent(next)}`} className={button("accent") + " block w-full text-center"}>Use a different email or resend</a>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="intent" value="send" />
      <input type="hidden" name="next" value={next} />
      <div>
        <label htmlFor="email" className={label}>Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} className={input} aria-describedby={state.error ? "email-error" : "email-hint"} />
        <p id="email-hint" className={hint}>We&apos;ll email you a secure sign-in link. No password to remember.</p>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="age13" className="mt-1 h-5 w-5 shrink-0" />
        <span>I&apos;m 13 or older. (<a href="/privacy" className="underline underline-offset-2">Privacy</a>)</span>
      </label>
      {(state.error || initialError) && <p id="email-error" role="alert" className="text-sm text-red-700">{state.error ?? initialError}</p>}
      <button className={button("accent") + " w-full"} disabled={pending}>{pending ? "Sending…" : "Email me a sign-in link"}</button>
    </form>
  );
}
