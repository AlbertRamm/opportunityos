import { describe, expect, it } from "vitest";
import { buildReminderEmail, signUnsubscribeToken, verifyUnsubscribeToken, type DueReminder } from "./reminders";

const SECRET = "x".repeat(40);
const UID = "11111111-2222-3333-4444-555555555555";
const rem = (over: Partial<DueReminder> = {}): DueReminder => ({
  log_id: 1, user_id: UID, email: "s@example.org", first_name: "Sam", opportunity_id: "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee",
  title: "Test <Program> & Co", organization: "Org", deadline: "2027-02-15", kind: "7d", days_left: 7, ...over,
});

describe("unsubscribe tokens", () => {
  it("round-trips for the right user and secret", () => {
    expect(verifyUnsubscribeToken(signUnsubscribeToken(UID, SECRET), SECRET)).toBe(UID);
  });
  it("rejects tampering, other secrets, other users, and junk", () => {
    const t = signUnsubscribeToken(UID, SECRET);
    expect(verifyUnsubscribeToken(t, "y".repeat(40))).toBeNull();
    expect(verifyUnsubscribeToken(t.replace(UID, "99999999-2222-3333-4444-555555555555"), SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(t.slice(0, -2) + "AA", SECRET)).toBeNull();
    for (const bad of [undefined, null, "", "nodot", "not-a-uuid.abc", `${UID}.`]) expect(verifyUnsubscribeToken(bad as string, SECRET)).toBeNull();
    expect(verifyUnsubscribeToken(t, "")).toBeNull();
  });
});

describe("reminder email", () => {
  it("says what, when, links to our detail page, and includes an unsubscribe link", () => {
    const m = buildReminderEmail(rem(), "https://site.example/", "https://site.example/unsubscribe?t=abc");
    expect(m.subject).toBe("Deadline in 7 days: Test <Program> & Co");
    expect(m.text).toContain("Feb 15, 2027");
    expect(m.text).toContain("https://site.example/opportunities/aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee");
    expect(m.text).toContain("https://site.example/unsubscribe?t=abc");
    expect(m.text).toMatch(/confirm on the organization's official page/);
  });
  it("uses tomorrow/today wording for short deadlines", () => {
    expect(buildReminderEmail(rem({ days_left: 1, kind: "2d" }), "https://s.org", "u").subject).toBe("Deadline tomorrow: Test <Program> & Co");
    expect(buildReminderEmail(rem({ days_left: 0, kind: "2d" }), "https://s.org", "u").text).toContain("today");
  });
  it("HTML-escapes titles (no injection through listing data)", () => {
    const m = buildReminderEmail(rem({ title: '<img src=x onerror=alert(1)>' }), "https://s.org", "u");
    expect(m.html).not.toContain("<img");
    expect(m.html).toContain("&lt;img");
  });
});
