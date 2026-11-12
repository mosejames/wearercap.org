// @vitest-environment node
import { describe, expect, it, vi } from "vitest";
import { unzipSync, strFromU8 } from "fflate";

const tables = {
  cr_requests: [{ id: "request-1", reference: 28, created_at: "2026-09-30", status: "approved", total_cents: 62753, approved_cents: 61905, approved_amount_reason: "Only $619.05 remains in the event budget", items: [{ receipts: [{ path: "user/request/one.pdf", name: "invoice.pdf" }] }], purpose: "=HYPERLINK(\"bad\")" }],
  cr_history: [{ id: "history-1", request_id: "request-1", action: "item_note", item_index: 0,
    note: "Expense 1: Bank statement reconciled", created_at: "2026-09-30" }],
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
    // The finance ZIP carries requested and approved side by side.
    const [header, row] = strFromU8(files["requests.csv"]).split("\r\n");
    const columns = header.split(",");
    expect(columns.indexOf("approved_cents")).toBe(columns.indexOf("total_cents") + 1);
    expect(columns).toContain("approved_amount_reason");
    expect(row).toContain('"62753","61905","Only $619.05 remains in the event budget"');
    const raw = JSON.parse(strFromU8(files["records.json"])).requests[0];
    expect([raw.total_cents, raw.approved_cents]).toEqual([62753, 61905]);
    expect(strFromU8(files["history.csv"])).toContain("item_index");
    expect(strFromU8(files["history.csv"])).toContain("Expense 1: Bank statement reconciled");
    expect(strFromU8(files["documents/request-28/one.pdf-invoice.pdf"])).toBe("invoice content");
  });
});
