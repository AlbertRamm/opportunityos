import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { DEFAULT_INTERESTS, resolveInterests } from "./interests";

const REQUIRED_LABELS = [
  "Electrical Engineering", "Computer Engineering", "Computer Science", "Semiconductor / Chips",
  "Mechanical Engineering", "Civil Engineering", "Aerospace", "Biology / Medicine", "Chemistry",
  "Environmental / Climate", "Business", "Finance", "Government / Public Policy", "Arts / Design",
  "Education", "Other",
];

describe("interest options (regression: onboarding showed none)", () => {
  it("built-in list contains every interest the product requires, with unique slugs", () => {
    expect(DEFAULT_INTERESTS.map((i) => i.label)).toEqual(REQUIRED_LABELS);
    expect(new Set(DEFAULT_INTERESTS.map((i) => i.slug)).size).toBe(DEFAULT_INTERESTS.length);
    for (const i of DEFAULT_INTERESTS) expect(i.slug).toMatch(/^[a-z0-9_]+$/);
  });

  it("falls back to the built-in list when the database returns nothing", () => {
    expect(resolveInterests([])).toEqual([...DEFAULT_INTERESTS]);
    expect(resolveInterests(null)).toEqual([...DEFAULT_INTERESTS]);
    expect(resolveInterests(undefined)).toEqual([...DEFAULT_INTERESTS]);
  });

  it("prefers database rows when present (so interests can be added with SQL)", () => {
    const rows = [{ slug: "robotics", label: "Robotics" }];
    expect(resolveInterests(rows)).toEqual(rows);
  });

  it.each(["20261002000000_init.sql", "20261003000000_ensure_interests.sql"])(
    "%s seeds exactly the built-in interests (code and SQL can't drift)",
    (file) => {
      const sql = fs.readFileSync(path.join(__dirname, "../../supabase/migrations", file), "utf8");
      const pairs = [...sql.matchAll(/\(\s*'([a-z0-9_]+)'\s*,\s*'([^']+)'\s*,\s*\d+\s*\)/g)].map((m) => ({ slug: m[1], label: m[2] }));
      expect(pairs).toEqual([...DEFAULT_INTERESTS]);
    },
  );
});
