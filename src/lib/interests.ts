// Canonical interest list. The `interests` table is the source of truth when it has rows (so new
// interests can be added with SQL, no deploy), but onboarding must NEVER render empty or reject every
// submission just because that table is empty/unreadable, so this list is the fallback.
// Keep in sync with supabase/migrations (enforced by interests.test.ts).
export interface Interest {
  slug: string;
  label: string;
}

export const DEFAULT_INTERESTS: readonly Interest[] = [
  { slug: "electrical_engineering", label: "Electrical Engineering" },
  { slug: "computer_engineering", label: "Computer Engineering" },
  { slug: "computer_science", label: "Computer Science" },
  { slug: "semiconductors", label: "Semiconductor / Chips" },
  { slug: "mechanical_engineering", label: "Mechanical Engineering" },
  { slug: "civil_engineering", label: "Civil Engineering" },
  { slug: "aerospace", label: "Aerospace" },
  { slug: "biology_medicine", label: "Biology / Medicine" },
  { slug: "chemistry", label: "Chemistry" },
  { slug: "environment_climate", label: "Environmental / Climate" },
  { slug: "business", label: "Business" },
  { slug: "finance", label: "Finance" },
  { slug: "government_policy", label: "Government / Public Policy" },
  { slug: "arts_design", label: "Arts / Design" },
  { slug: "education", label: "Education" },
  { slug: "other", label: "Other" },
];

/** DB rows if there are any; otherwise the canonical list. */
export function resolveInterests(rows: Interest[] | null | undefined): Interest[] {
  return rows && rows.length > 0 ? rows : [...DEFAULT_INTERESTS];
}
