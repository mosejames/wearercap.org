// @vitest-environment node
import { describe, it, expect, vi, afterEach } from "vitest";
import handler from "../../api/feedback-draft.js";
function res() {
  return {
    setHeader: vi.fn(),
    status: vi.fn(function (n) {
      this.code = n;
      return this;
    }),
    json: vi.fn(function (v) {
      this.body = v;
      return this;
    }),
  };
}
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe("drafting assistant boundary", () => {
  it("rejects invalid input before auth or AI calls", async () => {
    const fetch = vi.fn();
    vi.stubGlobal("fetch", fetch);
    const r = res();
    await handler({ method: "POST", body: { brief: "x", count: 99 } }, r);
    expect(r.code).toBe(400);
    expect(fetch).not.toHaveBeenCalled();
  });
  it("never calls OpenAI without organizer authorization", async () => {
    const fetch = vi.fn().mockResolvedValue({ ok: false });
    vi.stubGlobal("fetch", fetch);
    const r = res();
    await handler(
      { method: "POST", body: { brief: "Night out", count: 6 } },
      r,
    );
    expect(r.code).toBe(403);
    expect(fetch).toHaveBeenCalledTimes(1);
  });
  it("explains the unconfigured connection instead of pretending to generate", async () => {
    vi.stubEnv("OPENAI_API_KEY", "");
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: true }));
    const r = res();
    await handler(
      { method: "POST", body: { brief: "Night out", count: 6 } },
      r,
    );
    expect(r.code).toBe(503);
    expect(r.body.error).toContain("not connected");
  });
});
