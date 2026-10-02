"use client";

import { useActionState } from "react";
import { signIn, type SignInState } from "@/app/start/actions";
import { button, hint, input, label } from "./ui";

export function SignInForm({ next }: { next: string }) {
  const [state, action, pending] = useActionState<SignInState, FormData>(signIn, { step: "email" });

  if (state.step === "code") {
    return (
      <form action={action} className="space-y-5">
        <input type="hidden" name="intent" value="verify" />
        <input type="hidden" name="email" value={state.email} />
        <input type="hidden" name="next" value={next} />
        <p className="text-muted">We emailed a code to <strong className="text-ink">{state.email}</strong>. It can take a minute — check spam too.</p>
        <div>
          <label htmlFor="code" className={label}>Code from your email</label>
          <input id="code" name="code" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9 ]*" required autoFocus className={input + " text-2xl tracking-[0.3em]"} aria-describedby={state.error ? "code-error" : undefined} />
          {state.error && <p id="code-error" role="alert" className="mt-2 text-sm text-red-700">{state.error}</p>}
        </div>
        <button className={button("accent") + " w-full"} disabled={pending}>{pending ? "Checking…" : "Continue"}</button>
        <a href={`/start?next=${encodeURIComponent(next)}`} className="block text-center text-sm underline underline-offset-4">Use a different email or resend</a>
      </form>
    );
  }

  return (
    <form action={action} className="space-y-5">
      <input type="hidden" name="intent" value="send" />
      <div>
        <label htmlFor="email" className={label}>Email</label>
        <input id="email" name="email" type="email" autoComplete="email" required defaultValue={state.email} className={input} aria-describedby={state.error ? "email-error" : "email-hint"} />
        <p id="email-hint" className={hint}>We&apos;ll email you a sign-in code. No password to remember.</p>
      </div>
      <label className="flex items-start gap-3 text-sm">
        <input type="checkbox" name="age13" className="mt-1 h-5 w-5 shrink-0" />
        <span>I&apos;m 13 or older. (<a href="/privacy" className="underline underline-offset-2">Privacy</a>)</span>
      </label>
      {state.error && <p id="email-error" role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className={button("accent") + " w-full"} disabled={pending}>{pending ? "Sending…" : "Email me a code"}</button>
    </form>
  );
}
