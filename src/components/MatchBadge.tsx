import type { MatchStatus } from "@/lib/matching/types";

const META: Record<MatchStatus, { label: string; cls: string; icon: string }> = {
  strong_match: { label: "Strong Match", cls: "bg-emerald-100 text-emerald-900 border-emerald-300", icon: "★" },
  eligible: { label: "Eligible", cls: "bg-blue-100 text-blue-900 border-blue-300", icon: "✓" },
  check_requirement: { label: "Check Requirement", cls: "bg-amber-100 text-amber-900 border-amber-300", icon: "?" },
  not_eligible: { label: "Not Eligible", cls: "bg-neutral-200 text-neutral-800 border-neutral-300", icon: "✕" },
};

export const MATCH_LABEL: Record<MatchStatus, string> = {
  strong_match: "Strong Match",
  eligible: "Eligible",
  check_requirement: "Check Requirement",
  not_eligible: "Not Eligible",
};

export function MatchBadge({ status }: { status: MatchStatus }) {
  const m = META[status];
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${m.cls}`}>
      <span aria-hidden>{m.icon}</span>
      {m.label}
    </span>
  );
}
