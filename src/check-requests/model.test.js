import { describe, it, expect } from "vitest";
import {
  toCents,
  normalizePhone,
  validateDraft,
  validateFiles,
  actionAllowed,
  voters,
  tally,
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
      zelle_contact: "4045550123",
      budget_confirmed: true,
      committee: "General RCAP",
      purpose: "Supplies for an RCAP event",
      items: [
        {
          date: "2026-01-01",
          vendor: "Party City",
          description: "Supplies",
          amount: "25.00",
          document_total: "25.00",
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
  it("gives approval to the treasurer, not admins or former assignees", () => {
    expect(
      actionAllowed(r, "secretary", "secretary@example.test", "approved"),
    ).toBe(false);
    expect(actionAllowed(r, "manager", "chair@example.test", "approved")).toBe(
      false,
    );
    expect(actionAllowed(r, "approver", r.approver_email, "approved")).toBe(
      false,
    );
    expect(
      actionAllowed(r, "treasurer", "+19015550000", "approved"),
    ).toBe(true);
    expect(
      actionAllowed(r, "treasurer", "+19015550000", "board_review"),
    ).toBe(true);
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

describe("board votes and duplicates", () => {
  const staff = [
    { email: "+19015550000", name: "Treasurer T", role: "treasurer" },
    { email: "t@example.test", name: "Treasurer T", role: "treasurer" },
    { email: "+17705550000", name: "Board B", role: "board" },
    { email: "+16785550000", name: "Board C", role: "board" },
    { email: "+14045550000", name: "Chair M", role: "manager" },
  ];
  const r = { email: "+17705550000", status: "board_review" };
  it("counts each person once, never the requester or admins", () => {
    expect(voters(staff, r)).toEqual(["Board C", "Treasurer T"]);
  });
  it("counts only each voter's latest vote since the request went to the board", () => {
    const history = [
      { action: "vote_approve", actor_email: "+16785550000", created_at: "2026-09-01T10:00:00Z" },
      { action: "board_review", actor_email: "+19015550000", created_at: "2026-09-02T10:00:00Z" },
      { action: "vote_decline", actor_email: "+19015550000", created_at: "2026-09-02T11:00:00Z", note: "Too much" },
      { action: "vote_approve", actor_email: "t@example.test", created_at: "2026-09-02T12:00:00Z" },
    ];
    const t = tally(history, staff, r);
    expect(t).toMatchObject({ yes: 1, no: 0, need: 2 });
    expect(t.votes.find((v) => v.name === "Board C").vote).toBeNull();
  });
  it("lets board and admins close duplicates, and admins send back", () => {
    const open = { email: "parent@example.test", status: "submitted" };
    for (const role of ["board", "secretary", "manager", "treasurer"])
      expect(actionAllowed(open, role, "x", "duplicate")).toBe(true);
    expect(actionAllowed(open, null, "someone", "duplicate")).toBe(false);
    expect(actionAllowed(open, "manager", "x", "needs_changes")).toBe(true);
    expect(actionAllowed(open, "board", "x", "needs_changes")).toBe(false);
    expect(actionAllowed(r, "board", "x", "vote", { canVote: true })).toBe(true);
    expect(actionAllowed(r, "manager", "x", "vote", { canVote: false })).toBe(false);
  });
});

import { phoneIdentity, contactOf, validZelle } from "./model.js";
describe("cellphone identity and Zelle", () => {
  it("normalizes phone numbers consistently with verified auth identities", () => {
    expect(phoneIdentity("(404) 555-0123")).toBe("+14045550123");
    expect(phoneIdentity("+1 404 555 0123")).toBe("+14045550123");
    expect(phoneIdentity("123")).toBeNull();
    expect(contactOf({ phone: "14045550123" })).toBe("+14045550123");
  });
  it("accepts a Zelle email or cellphone and rejects invalid recipients", () => {
    expect(validZelle("parent@example.test")).toBe(true);
    expect(validZelle("(404) 555-0123")).toBe(true);
    expect(validZelle("invalid")).toBe(false);
    expect(validZelle("")).toBe(false);
  });
  it("gates actions by verified phone identity", () => {
    const r = { email: "+14045550123", status: "submitted" };
    expect(actionAllowed(r, "treasurer", "+14045550124", "approved")).toBe(true);
    expect(actionAllowed(r, "treasurer", "+14045550123", "approved")).toBe(
      false,
    );
  });
});

it("enforces budget, Zelle rules, and supported amounts for vendor and parent requests", () => {
  const d = {
    ...newDraft(),
    requester_name: "Test Parent",
    payee: "Vendor",
    phone: "4045550123",
    zelle_contact: "4045550123",
    committee: "General",
    purpose: "Event supplies for RCAP",
    budget_confirmed: true,
    acknowledged: true,
    items: [
      {
        date: "2026-01-01",
        vendor: "Target",
        description: "Covered supplies",
        amount: "20",
        document_total: "30",
        receipts: [{}],
      },
    ],
  };
  expect(validateDraft(d)).toBeNull();
  expect(validateDraft({ ...d, budget_confirmed: false })).toMatch(
    /within budget/,
  );
  expect(validateDraft({ ...d, delivery: "mail" })).toMatch(/Zelle/);
  expect(validateDraft({ ...d, delivery: "debit_card" })).toMatch(/Zelle/);
  expect(
    validateDraft({
      ...d,
      request_type: "vendor",
      delivery: "debit_card",
      zelle_contact: "",
    }),
  ).toBeNull();
  expect(
    validateDraft({ ...d, items: [{ ...d.items[0], amount: "30.01" }] }),
  ).toMatch(/must not exceed/);
});
