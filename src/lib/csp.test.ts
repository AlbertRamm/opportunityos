import { describe, expect, it } from "vitest";
import { buildCsp, cspHeaderName, cspMode } from "./csp";

describe("CSP", () => {
  const prod = buildCsp("abc123", false);
  it("is nonce-based with no unsafe-inline/eval for scripts in production", () => {
    expect(prod).toContain("script-src 'self' 'nonce-abc123' 'strict-dynamic'");
    const script = prod.split("; ").find((d) => d.startsWith("script-src"))!;
    expect(script).not.toMatch(/unsafe-inline|unsafe-eval/);
  });
  it("locks down framing, plugins, base URI, form targets, and connections", () => {
    for (const d of ["frame-ancestors 'none'", "object-src 'none'", "base-uri 'self'", "form-action 'self'", "connect-src 'self'", "upgrade-insecure-requests"]) {
      expect(prod.split("; ")).toContain(d);
    }
  });
  it("allows eval and websockets only in development", () => {
    expect(buildCsp("n", true)).toMatch(/'unsafe-eval'/);
    expect(prod).not.toMatch(/unsafe-eval|ws:/);
  });
  it("kill switch: enforce by default, report-only or off by env", () => {
    expect(cspMode(undefined)).toBe("enforce");
    expect(cspMode("garbage")).toBe("enforce");
    expect(cspHeaderName(cspMode("report-only"))).toBe("Content-Security-Policy-Report-Only");
    expect(cspHeaderName(cspMode("off"))).toBeNull();
  });
});
