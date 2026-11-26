"use client";

import { useState, useTransition } from "react";
import { removeUnavailableSavedOpportunity } from "@/app/actions";
import { button } from "./ui";

export function RemoveUnavailableSavedButton({ opportunityId }: { opportunityId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  return <div className="flex items-center gap-3">
    <button type="button" disabled={pending} className={button("secondary")} onClick={() => start(async () => {
      setError(false);
      const result = await removeUnavailableSavedOpportunity(opportunityId);
      if (result.ok) window.location.reload();
      else setError(true);
    })}>{pending ? "Removing…" : "Remove saved item"}</button>
    {error && <span role="alert" className="text-sm text-red-700">Couldn&apos;t remove it. Try again.</span>}
  </div>;
}
