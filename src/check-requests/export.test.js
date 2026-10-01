// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { unzipSync, strFromU8 } from "fflate";

const tables = {
  cr_requests: [{ id: "request-1", reference: 28, created_at: "2026-09-30", items: [{ receipts: [{ path: "user/request/one.pdf", name: "invoice.pdf" }] }], purpose: "=HYPERLINK(\"bad\")" }],
  cr_history: [{ id: "history-1", request_id: "request-1", action: "submitted", created_at: "2026-09-30" }],
  cr_notifications: [],
  cr_approval_route_history: [],
};
vi.mock("./api.js", () => ({
  supabase: {
    from: (table) => ({ select: () => ({ order: () => ({ order: () => ({ range: async () => ({ data: tables[table], error: null }) }) }) }) }),
    storage: { from: () => ({ download: async () => ({ data: new Blob(["invoice content"]), error: null }) }) },
  },
}));
import { financeArchive } from "./export.js";

describe("treasurer archive", () => {
  it("contains the ledger, audit history, raw records, and original document", async () => {
    const files = unzipSync(await financeArchive());
    expect(Object.keys(files)).toContain("requests.csv");
    expect(Object.keys(files)).toContain("history.csv");
    expect(Object.keys(files)).toContain("records.json");
    expect(Object.keys(files)).toContain("documents/request-28/one.pdf-invoice.pdf");
    expect(strFromU8(files["requests.csv"])).toContain("'=HYPERLINK");
    expect(strFromU8(files["documents/request-28/one.pdf-invoice.pdf"])).toBe("invoice content");
  });
});
