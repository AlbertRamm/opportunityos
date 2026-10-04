import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { hasMatchDetails, matchDetailsToStudent, MATCH_DETAIL_FIELDS, parseMatchDetails } from "./match-details";

const form = (o: Record<string, string>) => {
  const fd = new FormData();
  for (const [k, v] of Object.entries(o)) fd.set(k, v);
  return fd;
};

describe("parseMatchDetails", () => {
  it("blank form = nothing stored, no errors (onboarding never depends on it)", () => {
    const r = parseMatchDetails(form({}));
    expect(r.errors).toEqual({});
    expect(Object.values(r.columns).every((v) => v === null)).toBe(true);
    expect(hasMatchDetails(r.columns)).toBe(false);
  });
  it("accepts a complete GPA and rounds to 2 decimals", () => {
    const r = parseMatchDetails(form({ gpa_value: "3.456", gpa_scale: "4.0", gpa_weighting: "unweighted" }));
    expect(r.errors).toEqual({});
    expect(r.columns).toMatchObject({ gpa_value: 3.46, gpa_scale: "4.0", gpa_weighting: "unweighted" });
  });
  it("requires scale and weighting once a GPA is typed, and stores nothing from a half-filled GPA", () => {
    const r = parseMatchDetails(form({ gpa_value: "3.5" }));
    expect(r.errors.gpa_scale).toBeTruthy();
    expect(r.errors.gpa_weighting).toBeTruthy();
    expect(r.columns.gpa_value).toBeNull();
  });
  it("validates ranges per scale", () => {
    expect(parseMatchDetails(form({ gpa_value: "4.5", gpa_scale: "4.0", gpa_weighting: "weighted" })).errors.gpa_value).toMatch(/can't be above 4/);
    expect(parseMatchDetails(form({ gpa_value: "4.5", gpa_scale: "5.0", gpa_weighting: "weighted" })).errors).toEqual({});
    expect(parseMatchDetails(form({ gpa_value: "101", gpa_scale: "100", gpa_weighting: "not_sure" })).errors.gpa_value).toBeTruthy();
    expect(parseMatchDetails(form({ gpa_value: "-1", gpa_scale: "4.0", gpa_weighting: "weighted" })).errors.gpa_value).toBeTruthy();
    expect(parseMatchDetails(form({ gpa_value: "abc", gpa_scale: "4.0", gpa_weighting: "weighted" })).errors.gpa_value).toBeTruthy();
  });
  it("drops unknown enum values instead of storing them", () => {
    const r = parseMatchDetails(form({ attest_citizenship: "green_card", attest_financial_need: "income:50000", college_plan: "ivy" }));
    expect(r.columns.attest_citizenship).toBeNull();
    expect(r.columns.attest_financial_need).toBeNull();
    expect(r.columns.college_plan).toBeNull();
  });
  it("keeps the four allowed answers, including prefer_not", () => {
    for (const v of ["yes", "no", "not_sure", "prefer_not"]) {
      expect(parseMatchDetails(form({ attest_citizenship: v })).columns.attest_citizenship).toBe(v);
    }
  });
  it("round-trips to the matcher (numeric strings from PostgREST)", () => {
    expect(matchDetailsToStudent({ gpa_value: "3.50", gpa_scale: "4.0", gpa_weighting: "unweighted" }).gpaValue).toBe(3.5);
    expect(matchDetailsToStudent({}).gpaValue).toBeNull();
  });
});

// Static privacy-boundary checks: optional answers must not leak into logs, analytics, admin surfaces, or the browser bundle.
describe("privacy boundaries", () => {
  const root = path.resolve(__dirname, "../..");
  const read = (p: string) => fs.readFileSync(path.join(root, p), "utf8");
  const walk = (d: string): string[] =>
    fs.readdirSync(path.join(root, d), { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? walk(`${d}/${e.name}`) : [`${d}/${e.name}`]));
  const sensitive = /gpa_value|gpa_scale|gpa_weighting|attest_financial_need|attest_citizenship|college_plan|gpaValue|financialNeed|collegePlan/;

  it("no analytics event, console call, or admin page mentions an optional answer", () => {
    const files = walk("src").filter((f) => /\.(ts|tsx)$/.test(f) && !/\.test\./.test(f));
    for (const f of files) {
      const t = read(f);
      for (const call of t.match(/(trackEvent|console\.(log|warn|error|info))\([^;]*\)/g) ?? []) expect(call, `${f}: ${call}`).not.toMatch(sensitive);
      if (f.includes("(admin)")) expect(t, f).not.toMatch(sensitive);
    }
    expect(read("src/lib/analytics.ts")).not.toMatch(sensitive);
  });
  it("only the user-owned profiles table stores them; no policy or grant exposes them to anon/admin aggregates", () => {
    const mig = read("supabase/migrations/20261008000000_match_details.sql");
    expect(mig).not.toMatch(/grant .* to anon/i);
    expect(mig).not.toMatch(/create policy/i); // inherits the existing own-row-only RLS
    const metrics = fs.readdirSync(path.join(root, "supabase/migrations")).map((f) => read(`supabase/migrations/${f}`)).join("\n");
    const adminFn = metrics.slice(metrics.indexOf("function public.admin_metrics"));
    expect(adminFn.slice(0, 2500)).not.toMatch(sensitive);
  });
  it("the sensitive attributes we refuse to collect are absent from schema and code", () => {
    const all = walk("src").filter((f) => !/\.test\./.test(f)).map(read).join("\n") + read("supabase/migrations/20261008000000_match_details.sql");
    expect(all).not.toMatch(/immigration_status|citizenship_status|household_income|\bagi\b|fafsa|\bssn\b|social_security_number/i);
  });
  it("covers every stored column the parser writes", () => {
    const mig = read("supabase/migrations/20261008000000_match_details.sql");
    for (const c of MATCH_DETAIL_FIELDS) expect(mig).toContain(c);
  });
});
