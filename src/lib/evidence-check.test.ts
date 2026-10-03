import { describe, expect, it } from "vitest";
import { checkEvidence, findUnsupportedFields, quoteInText, urlKey, type Snapshot } from "./evidence-check";

const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
  url: "https://www.org.org/prog", fetched_at: "2026-10-03T12:00:00Z", status: 200, sha256: "x",
  text: "Applications are due  February 15, 2027 at 5 p.m. ET.\nStudents must be “rising juniors or seniors” aged 16–18.", ...over,
});
const map = (s: Snapshot) => new Map([[urlKey(s.url), s]]);
const NOW = new Date("2026-10-04T12:00:00Z");

describe("quoteInText", () => {
  it("matches verbatim text ignoring whitespace runs and typographic glyphs", () => {
    expect(quoteInText("Applications are due February 15, 2027", snap().text)).toBe(true);
    expect(quoteInText('must be "rising juniors or seniors" aged 16-18', snap().text)).toBe(true);
  });
  it("rejects paraphrases, altered facts, case changes and trivially short quotes", () => {
    expect(quoteInText("Applications are due February 16, 2027", snap().text)).toBe(false);
    expect(quoteInText("applications are due february 15, 2027", snap().text)).toBe(false);
    expect(quoteInText("due soon", snap().text)).toBe(false);
    expect(quoteInText("Applications close in February", snap().text)).toBe(false);
  });
});

describe("checkEvidence", () => {
  const ev = { application_deadline: { quote: "Applications are due February 15, 2027", url: "https://org.org/prog/" } };
  it("passes for a verbatim quote on a fresh snapshot (www/trailing-slash insensitive)", () => {
    expect(checkEvidence(ev, map(snap()), NOW, 7)).toEqual([]);
  });
  it("flags missing snapshot, stale snapshot, bad HTTP status, and fabricated quotes", () => {
    expect(checkEvidence(ev, new Map(), NOW, 7)[0].problem).toMatch(/no snapshot/);
    expect(checkEvidence(ev, map(snap({ fetched_at: "2026-09-01T00:00:00Z" })), NOW, 7).some((p) => /days old/.test(p.problem))).toBe(true);
    expect(checkEvidence(ev, map(snap({ status: 404 })), NOW, 7).some((p) => /HTTP status 404/.test(p.problem))).toBe(true);
    const fake = { application_deadline: { quote: "Applications are due March 1, 2027", url: "https://org.org/prog" } };
    expect(checkEvidence(fake, map(snap()), NOW, 7)[0].problem).toMatch(/NOT found verbatim/);
  });
});

describe("findUnsupportedFields", () => {
  it("requires evidence for every stated decision field (no inference)", () => {
    const row = { min_age: 16, max_age: 18, min_grade: 10, is_paid: true, allowed_states: ["DC"], application_deadline: "2027-02-15", allowed_zips: [], citizenship_requirement: null };
    expect(findUnsupportedFields(row, ["application_deadline"]).sort()).toEqual(["allowed_states", "is_paid", "max_age", "min_age", "min_grade"].sort());
  });
  it("group keys cover their fields; empty/null fields need nothing", () => {
    const row = { min_age: 16, max_age: 18, min_grade: 10, max_grade: 12, is_paid: false, allowed_states: ["DC", "MD"], application_deadline: "2027-02-15" };
    expect(findUnsupportedFields(row, ["age", "grade", "pay", "residency", "dates"])).toEqual([]);
    expect(findUnsupportedFields({ title: "x" }, [])).toEqual([]);
  });
  it("a rolling quote can justify a missing deadline field set to null", () => {
    expect(findUnsupportedFields({ application_deadline: null }, [])).toEqual([]);
  });
});
