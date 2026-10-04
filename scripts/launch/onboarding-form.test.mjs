// Proves the smoke flow's onboarding payload against the REAL ProfileForm markup (server-rendered), so a wrong
// field name/value in the harness is caught offline instead of burning a magic-link email.
import { createElement } from "react";
import { renderToString } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/app/onboarding/actions", () => ({ saveProfile: async () => ({}) }));

const { ProfileForm } = await import("@/components/ProfileForm");
const { buildFormData, findForm } = await import("./http-client.mjs");
const { onboardingOverrides } = await import("./smoke-http-flow.mjs");

const INTERESTS = ["government_policy", "computer_science", "biology_medicine", "arts_design", "business"].map((slug) => ({ slug, label: slug }));
const html = renderToString(createElement(ProfileForm, {
  interests: INTERESTS, initial: {}, submitLabel: "Show my opportunities",
  gradYearByGrade: { 9: 2030, 10: 2029, 11: 2028, 12: 2027 }, maxBirthDate: "2013-01-01", minBirthDate: "2005-01-01",
}));
const form = findForm(html, (f) => f.fields.some((x) => x.name === "first_name"));

describe("smoke onboarding payload vs the real form", () => {
  it("the form is found and exposes every field saveProfile reads", () => {
    expect(form).toBeTruthy();
    const names = new Set(form.fields.map((f) => f.name));
    for (const n of ["first_name", "birth_date", "grade", "graduation_year", "zip", "state", "school_name", "interests", "opportunity_types", "pay_preference", "work_mode_preference", "max_travel_miles", "available_school_year", "available_summer", "email_reminders"]) expect(names.has(n), n).toBe(true);
  });
  it("every submitted value is one the form actually offers, and satisfies saveProfile's rules", () => {
    const o = onboardingOverrides(form, new Date("2026-10-04T12:00:00Z"));
    const offered = (name) => form.fields.filter((f) => f.name === name).flatMap((f) => (f.type === "select" ? f.options.map((o) => o.value) : [f.value]));
    for (const i of o.interests) expect(offered("interests")).toContain(i);
    for (const t of o.opportunity_types) expect(offered("opportunity_types")).toContain(t);
    expect(o.interests.length).toBeGreaterThan(0);
    expect(o.opportunity_types.length).toBeGreaterThan(0);
    expect(offered("pay_preference")).toContain(o.pay_preference);
    expect(offered("work_mode_preference")).toContain(o.work_mode_preference);
    expect(offered("max_travel_miles")).toContain(o.max_travel_miles);
    expect(offered("grade")).toContain(o.grade);
    expect(offered("state")).toContain(o.state);
    expect(+o.graduation_year).toBe(2028); // grade 11 in Oct 2026 (matches expectedGraduationYear)
    expect(o.zip).toMatch(/^\d{5}$/);
    expect(o.available_summer).toBe("on");
  });
  it("builds a body that parses to exactly what the server action expects (hidden fields kept, unchecked dropped)", () => {
    const fd = buildFormData(form, onboardingOverrides(form, new Date("2026-10-04T12:00:00Z")));
    expect(fd.get("first_name")).toBe("Smoke");
    expect(fd.get("grade")).toBe("11");
    expect(fd.getAll("opportunity_types")).toEqual(["internship", "summer_program"]);
    expect(fd.has("available_school_year")).toBe(false);
    expect(fd.has("email_reminders")).toBe(false);
    expect(fd.getAll("pay_preference")).toEqual(["either"]); // radios: exactly one
    expect(fd.getAll("max_travel_miles")).toEqual(["50"]);
  });
});
