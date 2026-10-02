import { describe, expect, it } from "vitest";
import { ageOn, daysBetween, expectedGraduationYear, isIsoDate, todayET } from "./dates";

describe("dates", () => {
  it("ageOn counts completed years", () => {
    expect(ageOn("2010-03-15", "2026-03-14")).toBe(15);
    expect(ageOn("2010-03-15", "2026-03-15")).toBe(16);
    expect(ageOn("2008-02-29", "2026-02-28")).toBe(17);
  });
  it("daysBetween is signed and DST-safe", () => {
    expect(daysBetween("2026-03-07", "2026-03-09")).toBe(2);
    expect(daysBetween("2026-10-05", "2026-10-02")).toBe(-3);
  });
  it("validates real calendar dates", () => {
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("2026-02-28")).toBe(true);
    expect(isIsoDate("26-2-1")).toBe(false);
  });
  it("todayET uses New York's calendar day", () => {
    expect(todayET(new Date("2026-10-03T02:00:00Z"))).toBe("2026-10-02"); // 10pm ET on the 2nd
  });
  it("expectedGraduationYear rolls over July 1", () => {
    expect(expectedGraduationYear(10, "2026-10-02")).toBe(2029);
    expect(expectedGraduationYear(12, "2027-03-01")).toBe(2027);
    expect(expectedGraduationYear(10, "2027-07-01")).toBe(2030);
  });
});
