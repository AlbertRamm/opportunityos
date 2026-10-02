"use client";

import { useState, useTransition } from "react";
import { deleteAccount } from "@/app/onboarding/actions";
import { button } from "./ui";

export function DeleteAccount() {
  const [confirming, setConfirming] = useState(false);
  const [pending, start] = useTransition();
  const [error, setError] = useState(false);
  return (
    <section className="mt-16 border-t border-line pt-8" aria-labelledby="del">
      <h2 id="del" className="text-lg font-semibold">Delete my account</h2>
      <p className="mt-1 text-sm text-muted">Permanently removes your profile, saved opportunities, and activity. This can&apos;t be undone.</p>
      {!confirming ? (
        <button type="button" className={button("danger") + " mt-4"} onClick={() => setConfirming(true)}>Delete my account…</button>
      ) : (
        <div className="mt-4 flex flex-wrap items-center gap-3" role="alertdialog" aria-label="Confirm account deletion">
          <button type="button" className={button("danger")} disabled={pending}
            onClick={() => start(async () => { try { await deleteAccount(); } catch (e) { if ((e as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw e; setError(true); } })}>
            {pending ? "Deleting…" : "Yes, delete everything"}
          </button>
          <button type="button" className={button("secondary")} onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      )}
      {error && <p role="alert" className="mt-2 text-sm text-red-700">Couldn&apos;t delete your account. Try again.</p>}
    </section>
  );
}
