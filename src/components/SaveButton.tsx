"use client";

import { useOptimistic, useState, useTransition } from "react";
import { toggleSave } from "@/app/actions";
import { button } from "./ui";

export function SaveButton({ opportunityId, saved, compact = false }: { opportunityId: string; saved: boolean; compact?: boolean }) {
  const [pending, start] = useTransition();
  const [committed, setCommitted] = useState(saved);
  const [optimistic, setOptimistic] = useOptimistic(committed);
  const [error, setError] = useState(false);

  return (
    <>
      <button
        type="button"
        aria-pressed={optimistic}
        disabled={pending}
        className={button(optimistic ? "secondary" : "secondary") + (optimistic ? " border-ink bg-accent-soft" : "")}
        onClick={() =>
          start(async () => {
            const next = !committed;
            setOptimistic(next);
            setError(false);
            const res = await toggleSave(opportunityId, next);
            if (res.ok) setCommitted(next);
            else setError(true);
          })
        }
      >
        <span aria-hidden>{optimistic ? "★" : "☆"}</span>
        {optimistic ? "Saved" : "Save"}
        {compact ? null : <span className="sr-only"> opportunity</span>}
      </button>
      {error && <span role="alert" className="text-sm text-red-700">Couldn&apos;t save. Try again.</span>}
    </>
  );
}
