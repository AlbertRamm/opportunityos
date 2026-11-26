import { describe, expect, it } from "vitest";
import { validateOpportunityForm } from "./opportunity-validation";

function form(values: Record<string, string> = {}) {
  const fd = new FormData();
  fd.set("title", "Summer lab");
  fd.set("organization", "Research Center");
  fd.set("opportunity_type", "research");
  for (const [key, value] of Object.entries(values)) fd.set(key, value);
  return fd;
}

const interests = new Set<string>();

describe("opportunity cost and residency review", () => {
  it("keeps cost unknown until an administrator records a reviewed value", () => {
    const { row } = validateOpportunityForm(form(), interests, "save");
    expect(row.cost_status).toBe("unknown");
  });

  it("rejects a positive fee range marked free", () => {
    const { errors } = validateOpportunityForm(form({ cost_status: "free", cost_min: "50" }), interests, "save");
    expect(errors.cost_status).toMatch(/free listing/);
  });

  it("requires explicit cost and unrestricted-residency review before verification", () => {
    const { errors } = validateOpportunityForm(form({
      application_url: "https://example.org/apply",
      source_url: "https://example.org/program",
    }), interests, "verify");
    expect(errors.cost_status).toBeTruthy();
    expect(errors.residency_scope).toBeTruthy();
  });
});
