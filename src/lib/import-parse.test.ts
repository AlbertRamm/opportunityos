import { describe, expect, it } from "vitest";
import { normalizeUrlKey, parseBatch } from "./import-parse";

const VALID = new Set(["electrical_engineering", "computer_science"]);
const good = () => ({
  title: "Test Program", organization: "Test Org", opportunity_type: "internship",
  application_url: "https://www.testorg.org/apply", source_url: "https://www.testorg.org/program",
  interests: ["computer_science"], min_age: 16, min_grade: 10, max_grade: 12,
  allowed_states: ["DC", "MD", "VA"], application_deadline: "2027-02-15",
  unstructured_requirements: ["Letter of recommendation"], is_paid: true,
  evidence: { application_deadline: { quote: "Applications are due February 15, 2027", url: "https://www.testorg.org/program" } },
});
const parse = (arr: unknown[]) => {
  const r = parseBatch(JSON.stringify(arr), VALID);
  if (!r.ok) throw new Error(r.error);
  return r.records;
};

describe("importer", () => {
  it("accepts a fully sourced record and maps arrays to DB values", () => {
    const [r] = parse([good()]);
    expect(r.errors).toEqual({});
    expect(r.row).toMatchObject({
      title: "Test Program", opportunity_type: "internship", min_age: 16, allowed_states: ["DC", "MD", "VA"],
      unstructured_requirements: ["Letter of recommendation"], is_paid: true, application_deadline: "2027-02-15",
    });
    expect(r.evidence.application_deadline.quote).toContain("February 15, 2027");
  });
  it("rejects placeholder / example hosts as sources", () => {
    const [r] = parse([{ ...good(), source_url: "https://example.org/x" }]);
    expect(r.errors.source_url).toMatch(/Placeholder/);
  });
  it("requires deadline evidence (never trusts an unsourced date)", () => {
    const rec = good() as Record<string, unknown>;
    delete rec.evidence;
    const [r] = parse([rec]);
    expect(r.errors["evidence.application_deadline"]).toBeTruthy();
  });
  it("allows rolling programs only with explicit rolling evidence", () => {
    const rec = { ...good(), application_deadline: undefined, evidence: { rolling: { quote: "Applications accepted on a rolling basis", url: "https://www.testorg.org/program" } } };
    expect(parse([rec])[0].errors).toEqual({});
    expect(parse([{ ...rec, evidence: {} }])[0].errors.application_deadline).toBeTruthy();
  });
  it("reuses form validation: bad ranges, unknown interests, bad URLs, bad dates", () => {
    const [r] = parse([{ ...good(), min_age: 20, max_age: 15, interests: ["nonsense"], application_url: "javascript:alert(1)", application_deadline: "2027-02-30" }]);
    expect(r.errors.max_age).toBeTruthy();
    expect(r.errors.interests).toBeTruthy();
    expect(r.errors.application_url).toBeTruthy();
    expect(r.errors.application_deadline).toBeTruthy();
  });
  it("never invents values: omitted eligibility stays null/empty", () => {
    const [r] = parse([{ title: "X", organization: "Y", opportunity_type: "research", source_url: "https://a.org/p", application_url: "https://a.org/a", application_deadline: "2027-01-01", evidence: { application_deadline: { quote: "q", url: "https://a.org/p" } } }]);
    expect(r.row).toMatchObject({ min_age: null, max_age: null, min_grade: null, citizenship_requirement: null, min_gpa: null, is_paid: null, allowed_states: [] });
  });
  it("rejects malformed batches", () => {
    expect(parseBatch("nope", VALID)).toMatchObject({ ok: false });
    expect(parseBatch("{}", VALID)).toMatchObject({ ok: false });
    expect(parseBatch("[]", VALID)).toMatchObject({ ok: false });
    expect(parseBatch(JSON.stringify(Array.from({ length: 101 }, good)), VALID)).toMatchObject({ ok: false });
  });
  it("normalizes URLs for duplicate detection", () => {
    expect(normalizeUrlKey("https://WWW.Org.org/a/")).toBe(normalizeUrlKey("https://www.org.org/a"));
  });
});
