import { describe, it, expect } from "vitest";
import {
  toCents,
  normalizePhone,
  validateDraft,
  validateFiles,
  receiptMime,
  actionAllowed,
  voters,
  tally,
  addReceipts,
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
  it("uses receipt bytes instead of a misleading filename or MIME type", async () => {
    const png = new Blob([new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])], { type: "image/jpeg" });
    expect(await receiptMime(png)).toBe("image/png");
    await expect(receiptMime(new Blob(["not an image"], { type: "image/png" })))
      .rejects.toThrow(/not a valid PDF/);
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
  it("keeps unassigned decisions with a named board reviewer", () => {
    expect(
      actionAllowed(r, "secretary", "secretary@example.test", "approved"),
    ).toBe(false);
    expect(actionAllowed(r, "manager", "chair@example.test", "approved")).toBe(
      false,
    );
    expect(actionAllowed(r, "approver", r.approver_email, "approved")).toBe(
      false,
    );
    expect(actionAllowed(r, "treasurer", "+19015550000", "approved")).toBe(
      false,
    );
    expect(actionAllowed(r, "treasurer", "+19015550000", "board_review")).toBe(
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
  it("routes a new request to its configured reviewer", () => {
    const routed = { ...r, routed_approval: true };
    expect(actionAllowed(routed, "board", r.approver_email, "approved")).toBe(true);
    expect(actionAllowed(routed, "treasurer", "treasurer@example.test", "approved")).toBe(false);
    expect(actionAllowed(routed, "board", r.approver_email, "needs_changes")).toBe(true);
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
      {
        action: "vote_approve",
        actor_email: "+16785550000",
        created_at: "2026-09-01T10:00:00Z",
      },
      {
        action: "board_review",
        actor_email: "+19015550000",
        created_at: "2026-09-02T10:00:00Z",
      },
      {
        action: "vote_decline",
        actor_email: "+19015550000",
        created_at: "2026-09-02T11:00:00Z",
        note: "Too much",
      },
      {
        action: "vote_approve",
        actor_email: "t@example.test",
        created_at: "2026-09-02T12:00:00Z",
      },
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
    expect(actionAllowed(r, "board", "x", "vote", { canVote: true })).toBe(
      true,
    );
    expect(actionAllowed(r, "manager", "x", "vote", { canVote: false })).toBe(
      false,
    );
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
    const r = { email: "+14045550123", approver_email: "+14045550124", routed_approval: true, status: "submitted" };
    expect(actionAllowed(r, "board", "+14045550124", "approved")).toBe(
      true,
    );
    expect(actionAllowed(r, "board", "+14045550123", "approved")).toBe(
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
        partial: true,
        coverage_note: "Personal items excluded from RCAP request.",
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

describe("adding receipts to an expense", () => {
  const f = (name, size = 100, type = "image/png") => ({ name, size, type });
  it("keeps what is already attached, including uploaded receipts", () => {
    const existing = [{ path: "u/r/a.png", name: "payment.png" }];
    const out = addReceipts(existing, [
      f("invoice.pdf", 200, "application/pdf"),
    ]);
    expect(out.receipts.map((r) => r.name)).toEqual([
      "payment.png",
      "invoice.pdf",
    ]);
  });
  it("skips a file picked twice and holds the total to five", () => {
    const once = addReceipts([], [f("a.png"), f("b.png")]).receipts;
    expect(addReceipts(once, [f("a.png"), f("c.png")]).receipts).toHaveLength(
      3,
    );
    const four = addReceipts(
      [],
      [f("1.png"), f("2.png"), f("3.png"), f("4.png")],
    ).receipts;
    expect(addReceipts(four, [f("5.png"), f("6.png")]).error).toMatch(
      /already has 4/,
    );
  });
  it("still rejects unsupported and oversized files", () => {
    expect(addReceipts([], [f("x.gif", 10, "image/gif")]).error).toMatch(
      /PDF, JPG, or PNG/,
    );
    expect(addReceipts([], [f("big.png", 11 * 1024 * 1024)]).error).toMatch(
      /10 MB/,
    );
  });
});

it("requires independent assigned approval and lets the preparing treasurer record payment afterward", () => {
  const r = {
    email: "latasha@test.com",
    payee_contact: "crystal@test.com",
    on_behalf: true,
    approver_email: "mose@test.com",
    status: "submitted",
  };
  expect(actionAllowed(r, "manager", "mose@test.com", "approved")).toBe(true);
  expect(actionAllowed(r, "treasurer", "latasha@test.com", "approved")).toBe(
    false,
  );
  expect(actionAllowed(r, "treasurer", "someone@test.com", "approved")).toBe(
    false,
  );
  expect(
    actionAllowed(
      { ...r, status: "approved" },
      "treasurer",
      "latasha@test.com",
      "paid",
    ),
  ).toBe(true);
  expect(
    actionAllowed(
      { ...r, status: "approved" },
      "treasurer",
      "crystal@test.com",
      "paid",
    ),
  ).toBe(false);
});

import { milestones as withdrawMilestones } from "./model.js";
describe("withdrawing a request", () => {
  const mine = "parent@example.test";
  it("lets only the requester withdraw, and only before approval", () => {
    for (const status of ["submitted", "board_review", "needs_changes"])
      expect(actionAllowed({ email: mine, status }, null, mine, "withdraw")).toBe(true);
    for (const status of ["approved", "declined", "paid"])
      expect(actionAllowed({ email: mine, status }, null, mine, "withdraw")).toBe(false);
    const open = { email: mine, status: "submitted" };
    for (const role of ["board", "secretary", "manager", "treasurer"])
      expect(actionAllowed(open, role, "someone@example.test", "withdraw")).toBe(false);
    expect(
      actionAllowed({ ...open, archived_at: "2026-11-02T00:00:00Z" }, null, mine, "withdraw"),
    ).toBe(false);
  });
  it("shows the withdrawal as the outcome, with no payment step", () => {
    const history = [
      { action: "submitted", actor_email: mine, created_at: "2026-11-01T10:00:00Z" },
      { action: "withdrawn", actor_email: mine, created_at: "2026-11-02T10:00:00Z" },
    ];
    const steps = withdrawMilestones(
      { status: "declined", requester_name: "Parent P" },
      history,
      [],
    );
    expect(steps.map((s) => s.label)).toEqual(["Submitted", "Withdrawn by requester"]);
    expect(steps[1].done).toBe(true);
  });
});

import {
  approvedCents,
  amountDiffers,
  payableCents,
  checkApprovedAmount,
  isCommitteeLiaison,
} from "./model.js";
describe("adjustable approved amount", () => {
  const request = { total_cents: 62753, status: "submitted" };
  it("keeps the requested amount and reads the approved amount beside it", () => {
    expect(approvedCents(request)).toBe(null);
    expect(payableCents(request)).toBe(62753);
    expect(amountDiffers(request)).toBe(false);
    const reduced = { ...request, status: "approved", approved_cents: 61905 };
    expect(approvedCents(reduced)).toBe(61905);
    expect(payableCents(reduced)).toBe(61905);
    expect(reduced.total_cents).toBe(62753);
    expect(amountDiffers(reduced)).toBe(true);
    expect(amountDiffers({ ...reduced, approved_cents: 62753 })).toBe(false);
    // A record loaded by an older page, before the column existed.
    expect(approvedCents({ ...request, status: "paid" })).toBe(62753);
    // A declined request has no approved amount, whatever the row holds.
    expect(approvedCents({ ...request, status: "declined", approved_cents: 100 })).toBe(null);
  });
  it("approves the full amount with no reason", () => {
    expect(checkApprovedAmount("627.53", request, "")).toEqual({ cents: 62753, reason: "" });
  });
  it("approves a lower amount only with a reason", () => {
    expect(checkApprovedAmount("619.05", request, "").error).toMatch(/reason/);
    expect(checkApprovedAmount("619.05", request, " no ").error).toMatch(/reason/);
    expect(
      checkApprovedAmount("619.05", request, " Only $619.05 remains in the budget. "),
    ).toEqual({ cents: 61905, reason: "Only $619.05 remains in the budget." });
    expect(checkApprovedAmount("619.05", request, "x".repeat(501)).error).toMatch(/500/);
  });
  it("rejects zero, negative, malformed and above-requested amounts", () => {
    for (const bad of ["0", "0.00", "-5", "", "abc", "619.055", "1,000"])
      expect(checkApprovedAmount(bad, request, "A good reason").error).toMatch(/greater than zero/);
    expect(checkApprovedAmount("627.54", request, "A good reason").error).toMatch(
      /cannot be more than the \$627\.53 requested/,
    );
  });
  it("requires a new amount and a reason for every correction", () => {
    const approved = { ...request, status: "approved", approved_cents: 61905 };
    const fix = (value, reason) =>
      checkApprovedAmount(value, approved, reason, { correction: true });
    expect(fix("619.05", "Recount of the budget").error).toMatch(/different amount/);
    expect(fix("600", "").error).toMatch(/reason for the correction/);
    expect(fix("627.54", "Recount of the budget").error).toMatch(/cannot be more/);
    expect(fix("0", "Recount of the budget").error).toMatch(/greater than zero/);
    expect(fix("600", "Recount of the budget")).toEqual({
      cents: 60000,
      reason: "Recount of the budget",
    });
    // Restoring the full requested amount is still a correction with a reason.
    expect(fix("627.53", "")).toHaveProperty("error");
    expect(fix("627.53", "Committee released the funds")).toEqual({
      cents: 62753,
      reason: "Committee released the funds",
    });
  });
  const staff = [
    { email: "+14045550001", name: "Liaison Person", role: "board" },
    { email: "liaison@example.test", name: "Liaison Person", role: "board" },
    { email: "+14045550002", name: "Other Member", role: "board" },
    { email: "+14045550003", name: "Treasurer Person", role: "treasurer" },
  ];
  const routes = [
    { committee: "Fall Event", request_type: "reimbursement", approver_email: "+14045550001", backup_email: "+14045550002" },
    { committee: "Fall Event", request_type: "vendor", approver_email: "+14045550002" },
  ];
  it("treats the committee's primary reviewer as the liaison, under either login", () => {
    const r = { committee: "Fall Event", request_type: "reimbursement" };
    expect(isCommitteeLiaison(r, routes, staff, "+14045550001")).toBe(true);
    expect(isCommitteeLiaison(r, routes, staff, "liaison@example.test")).toBe(true);
    // The backup reviewer and other members are not the liaison.
    expect(isCommitteeLiaison(r, routes, staff, "+14045550002")).toBe(false);
    expect(isCommitteeLiaison(r, routes, staff, "+14045550003")).toBe(false);
    // The mapping is per request type, so vendor payments follow their own route.
    expect(isCommitteeLiaison({ ...r, request_type: "vendor" }, routes, staff, "+14045550002")).toBe(true);
    expect(isCommitteeLiaison({ ...r, committee: "No Route" }, routes, staff, "+14045550001")).toBe(false);
    expect(isCommitteeLiaison(r, [], staff, "+14045550001")).toBe(false);
  });
  it("lets only the treasurer and the liaison correct, and only before payment", () => {
    const approved = { email: "parent@example.test", status: "approved", total_cents: 62753, approved_cents: 62753 };
    const can = (r, role, email, opts) => actionAllowed(r, role, email, "correct_amount", opts);
    expect(can(approved, "treasurer", "+14045550003")).toBe(true);
    expect(can(approved, "board", "+14045550001", { isLiaison: true })).toBe(true);
    expect(can(approved, "manager", "+14045550001", { isLiaison: true })).toBe(true);
    for (const role of ["board", "secretary", "manager", null])
      expect(can(approved, role, "+14045550002", { isLiaison: false })).toBe(false);
    // Nobody corrects their own request, including under a second login.
    expect(can(approved, "treasurer", "parent@example.test")).toBe(false);
    expect(can(approved, "treasurer", "+14045550003", { ownerIsMe: true })).toBe(false);
    expect(
      can({ ...approved, on_behalf: true, payee_contact: "+14045550001" }, "board", "+14045550001", { isLiaison: true }),
    ).toBe(false);
    // Locked once payment is recorded, and never open before approval.
    for (const status of ["paid", "submitted", "board_review", "needs_changes", "declined"])
      expect(can({ ...approved, status }, "treasurer", "+14045550003")).toBe(false);
    expect(can({ ...approved, archived_at: "2026-11-11T00:00:00Z" }, "treasurer", "+14045550003")).toBe(false);
  });
  it("leaves approval routing and self-approval rules as they were", () => {
    const open = { email: "parent@example.test", status: "submitted", approver_email: "+14045550001", routed_approval: true };
    expect(actionAllowed(open, "board", "+14045550001", "approved")).toBe(true);
    expect(actionAllowed(open, "board", "+14045550002", "approved")).toBe(false);
    expect(actionAllowed(open, "treasurer", "+14045550003", "approved")).toBe(false);
    expect(actionAllowed({ ...open, email: "+14045550001" }, "board", "+14045550001", "approved")).toBe(false);
  });
});
