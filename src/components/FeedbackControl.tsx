"use client";

import { useState, useTransition } from "react";
import { submitFeedback, undoFeedback } from "@/app/actions";
import { FEEDBACK_REASONS, type FeedbackReason } from "@/lib/feedback";
import { button } from "./ui";

export function FeedbackControl({ opportunityId, hidden = false }: { opportunityId: string; hidden?: boolean }) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<FeedbackReason | "">("");
  const [state, setState] = useState<"idle" | "sent" | "undone">(hidden ? "sent" : "idle");
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  if (state === "sent") {
    return (
      <div className="mt-4 flex flex-wrap items-center gap-3 border-t border-line pt-3 text-sm" role="status">
        <span className="text-muted">{hidden ? "You marked this as not a good match." : "Thanks — we won't show this one in your list."}</span>
        <button type="button" className="underline underline-offset-4" disabled={pending}
          onClick={() => start(async () => { const r = await undoFeedback(opportunityId); if (r.ok) { setState("undone"); } else setError(true); })}>
          Undo
        </button>
        {error && <span role="alert" className="text-red-700">Couldn&apos;t undo. Try again.</span>}
      </div>
    );
  }
  if (state === "undone") return <p className="mt-4 border-t border-line pt-3 text-sm text-muted" role="status">Restored to your list.</p>;

  if (!open) {
    return (
      <div className="mt-4 border-t border-line pt-3">
        <button type="button" className="inline-flex min-h-9 items-center text-sm text-muted underline underline-offset-4 hover:text-ink" onClick={() => setOpen(true)} aria-expanded={false}>
          Not a good match?
        </button>
      </div>
    );
  }

  return (
    <fieldset className="mt-4 border-t border-line pt-3" aria-label="Why isn't this a good match?">
      <legend className="sr-only">Why isn&apos;t this a good match?</legend>
      <p className="mb-2 text-sm font-medium">What&apos;s the main reason?</p>
      <div className="space-y-1.5">
        {FEEDBACK_REASONS.map((r) => (
          <label key={r.value} className="flex min-h-9 cursor-pointer items-center gap-2.5 text-sm">
            <input type="radio" name={`fb-${opportunityId}`} value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="h-4 w-4" />
            {r.label}
          </label>
        ))}
      </div>
      {error && <p role="alert" className="mt-2 text-sm text-red-700">Couldn&apos;t send. Try again.</p>}
      <div className="mt-3 flex gap-2">
        <button type="button" className={button("primary")} disabled={!reason || pending}
          onClick={() => start(async () => { setError(false); const r = await submitFeedback(opportunityId, reason); if (r.ok) setState("sent"); else setError(true); })}>
          {pending ? "Sending…" : "Send"}
        </button>
        <button type="button" className={button("ghost")} onClick={() => setOpen(false)}>Cancel</button>
      </div>
      <p className="mt-2 text-xs text-muted">Only the reason you pick is saved — no text. We use it to improve matches and fix wrong data.</p>
    </fieldset>
  );
}
