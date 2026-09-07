import { describe, it, expect } from "vitest";
import {
  toCents,
  normalizePhone,
  validateDraft,
  validateFiles,
  actionAllowed,
  newDraft,
} from "./model.js";
describe("check request validation", () => {
  it("uses exact integer cents and refuses malformed amounts", () => {
    expect(toCents("10.29")).toBe(1029);
    expect(toCents("0.01")).toBe(1);
    for (const v of [
      "0",
      "-2",
      "1.234",
      "1e3",
      "Infinity",
      "1,000",
      "NaN",
      "1000001",
    ])
      expect(toCents(v)).toBeNull();
  });
  it("normalizes US phone formatting", () => {
    expect(normalizePhone("+1 (404) 555-0123")).toBe("4045550123");
  });
  it("requires a receipt for every item and acknowledgement", () => {
    const d = {
      ...newDraft(),
      requester_name: "Test Parent",
      payee: "Test Parent",
      phone: "4045550123",
      committee: "General RCAP",
      purpose: "Supplies for an RCAP event",
      items: [
        {
          date: "2026-01-01",
          description: "Supplies",
          amount: "25.00",
          receipts: [],
        },
      ],
    };
    expect(validateDraft(d)).toMatch(/receipt/);
    d.items[0].receipts = [{ name: "receipt.pdf" }];
    expect(validateDraft(d)).toMatch(/Confirm/);
    d.acknowledged = true;
    expect(validateDraft(d)).toBeNull();
    d.items.push({ ...d.items[0], receipts: [] });
    expect(validateDraft(d)).toMatch(/expense 2/);
  });
  it("rejects unsupported, empty, and oversized files", () => {
    expect(validateFiles([{ type: "text/html", size: 100 }])).toMatch(/PDF/);
    expect(validateFiles([{ type: "application/pdf", size: 0 }])).toMatch(
      /10 MB/,
    );
    expect(
      validateFiles([{ type: "image/png", size: 11 * 1024 * 1024 }]),
    ).toMatch(/10 MB/);
    expect(validateFiles([{ type: "application/pdf", size: 100 }])).toBeNull();
  });
});
describe("finance action visibility", () => {
  const r = {
    email: "parent@example.test",
    approver_email: "reviewer@example.test",
    status: "submitted",
  };
  it("never offers self-approval or self-payment", () => {
    expect(
      actionAllowed(
        { ...r, approver_email: r.email },
        "secretary",
        r.email,
        "approved",
      ),
    ).toBe(false);
    expect(
      actionAllowed({ ...r, status: "approved" }, "treasurer", r.email, "paid"),
    ).toBe(false);
  });
  it("separates assigned approval from secretary and treasurer work", () => {
    expect(
      actionAllowed(r, "secretary", "secretary@example.test", "approved"),
    ).toBe(false);
    expect(actionAllowed(r, "approver", r.approver_email, "approved")).toBe(
      true,
    );
    expect(
      actionAllowed(r, "secretary", "secretary@example.test", "needs_changes"),
    ).toBe(true);
    expect(
      actionAllowed(
        { ...r, status: "approved" },
        "treasurer",
        "treasurer@example.test",
        "paid",
      ),
    ).toBe(true);
    expect(
      actionAllowed(r, "treasurer", "treasurer@example.test", "paid"),
    ).toBe(false);
  });
  it("only reopens returned requests for their owner", () => {
    expect(
      actionAllowed({ ...r, status: "needs_changes" }, null, r.email, "edit"),
    ).toBe(true);
    expect(actionAllowed(r, null, r.email, "edit")).toBe(false);
  });
});
