"use client";

import { useActionState } from "react";
import { unsubscribe } from "@/app/unsubscribe/actions";
import { button } from "./ui";

export function UnsubscribeForm({ token }: { token: string }) {
  const [state, action, pending] = useActionState(unsubscribe, {});
  if (state.done) {
    return <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-emerald-900">Done — you won&apos;t get deadline reminder emails. You can turn them back on any time in your Profile.</p>;
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="t" value={token} />
      {state.error && <p role="alert" className="text-sm text-red-700">{state.error}</p>}
      <button className={button("primary")} disabled={pending}>{pending ? "Working…" : "Turn off deadline reminders"}</button>
    </form>
  );
}
