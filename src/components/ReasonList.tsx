import type { MatchReason } from "@/lib/matching/types";

const ICON: Record<MatchReason["outcome"], { glyph: string; cls: string; sr: string }> = {
  met: { glyph: "✓", cls: "text-emerald-700", sr: "Met:" },
  unmet: { glyph: "✕", cls: "text-red-700", sr: "Not met:" },
  unknown: { glyph: "?", cls: "text-amber-700 font-bold", sr: "Needs confirmation:" },
  info: { glyph: "•", cls: "text-muted", sr: "Note:" },
};

export function ReasonList({ reasons, className = "" }: { reasons: MatchReason[]; className?: string }) {
  if (reasons.length === 0) return null;
  return (
    <ul className={`space-y-1.5 text-sm ${className}`}>
      {reasons.map((r) => {
        const i = ICON[r.outcome];
        return (
          <li key={r.code} className="flex gap-2">
            <span aria-hidden className={`w-4 shrink-0 text-center ${i.cls}`}>{i.glyph}</span>
            <span><span className="sr-only">{i.sr} </span>{r.text}</span>
          </li>
        );
      })}
    </ul>
  );
}
