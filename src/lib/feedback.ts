// Client-safe. The picklist is the only input: no free text is collected (minors → no accidental PII).
export const FEEDBACK_REASONS = [
  { value: "topic", label: "Not my interest" },
  { value: "type", label: "Not the kind of opportunity I want" },
  { value: "too_far", label: "Too far away" },
  { value: "pay", label: "Pay doesn't work for me" },
  { value: "timing", label: "Bad timing / I'm not available" },
  { value: "eligibility_wrong", label: "I'm actually not eligible (our check is wrong)" },
  { value: "info_outdated", label: "Info looks outdated or wrong" },
  { value: "other", label: "Something else" },
] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number]["value"];
export const FEEDBACK_VALUES: readonly string[] = FEEDBACK_REASONS.map((r) => r.value);
export const FEEDBACK_LABEL: Record<string, string> = Object.fromEntries(FEEDBACK_REASONS.map((r) => [r.value, r.label]));
