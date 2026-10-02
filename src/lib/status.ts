// Client-safe (no server-only imports).
export type ApplicationStatus = "planning" | "applied" | "interview" | "accepted" | "not_selected" | "not_interested";
export const STATUS_LABELS: Record<ApplicationStatus, string> = {
  planning: "Planning to apply",
  applied: "Applied",
  interview: "Interview",
  accepted: "Accepted",
  not_selected: "Not selected",
  not_interested: "No longer interested",
};
