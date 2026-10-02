"use client";

import { useState, useTransition } from "react";
import { setApplicationStatus } from "@/app/actions";
import { STATUS_LABELS, type ApplicationStatus } from "@/lib/status";
import { input } from "./ui";

export function StatusSelect({ opportunityId, status }: { opportunityId: string; status: ApplicationStatus | null }) {
  const [value, setValue] = useState<ApplicationStatus | "">(status ?? "");
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  const id = `status-${opportunityId}`;

  return (
    <div>
      <label htmlFor={id} className="block text-sm font-medium mb-1.5">Where are you with this? <span className="font-normal text-muted">(optional, only you and our aggregate stats see this)</span></label>
      <select
        id={id}
        className={input}
        value={value}
        disabled={pending}
        onChange={(e) => {
          const next = e.target.value as ApplicationStatus | "";
          const prev = value;
          setValue(next);
          setError(false);
          start(async () => {
            const res = await setApplicationStatus(opportunityId, next === "" ? null : next);
            if (!res.ok) {
              setValue(prev);
              setError(true);
            }
          });
        }}
      >
        <option value="">No update</option>
        {(Object.keys(STATUS_LABELS) as ApplicationStatus[]).map((s) => (
          <option key={s} value={s}>{STATUS_LABELS[s]}</option>
        ))}
      </select>
      {error && <p role="alert" className="mt-1 text-sm text-red-700">Couldn&apos;t update. Try again.</p>}
    </div>
  );
}
