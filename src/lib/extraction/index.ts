import type { Opportunity } from "@/lib/matching/types";

/**
 * A *proposal* for opportunity fields, produced from a web page.
 * Nothing returned here is trusted: a human reviews it in the admin form and verifies it.
 * The deterministic matching engine only ever sees verified, human-approved records.
 */
export type ProposedFields = Partial<
  Pick<
    Opportunity,
    | "title" | "organization" | "description" | "applicationUrl" | "type" | "interests" | "minAge" | "maxAge"
    | "minGrade" | "maxGrade" | "allowedStates" | "isPaid" | "compensationDescription" | "applicationDeadline"
    | "programStartDate" | "programEndDate" | "unstructuredRequirements"
  >
>;

export type ExtractionResult =
  | { status: "not_configured"; reason: string }
  | { status: "failed"; reason: string }
  | {
      status: "proposed";
      fields: ProposedFields;
      /** Quote/snippet from the page backing each proposed field, so the reviewer can check it. */
      evidence: Partial<Record<keyof ProposedFields, string>>;
    };

export interface OpportunityExtractor {
  readonly name: string;
  extract(sourceUrl: string): Promise<ExtractionResult>;
}

/** V0: no extraction. Deliberately returns nothing rather than pretending. */
export const notConfiguredExtractor: OpportunityExtractor = {
  name: "none",
  async extract() {
    return {
      status: "not_configured",
      reason: "Automatic extraction is not enabled in V0. Enter the fields by hand from the official page.",
    };
  },
};

/** Single swap point: return an AI-backed extractor here later. Its output must still go through human verification. */
export function getExtractor(): OpportunityExtractor {
  return notConfiguredExtractor;
}
