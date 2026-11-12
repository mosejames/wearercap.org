// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Detail, RequestList } from "./main.jsx";
import { act as send, loadRoutes } from "./api.js";
vi.mock("./ReceiptThumbs.jsx", () => ({ default: () => null }));
vi.mock("./PdfDownloads.jsx", () => ({ default: () => null }));
vi.mock("./ApprovalRecipients.jsx", () => ({ default: () => null }));
vi.mock("./api.js", () => ({
  supabase: {},
  loadRequests: vi.fn(),
  loadStaff: vi.fn(),
  loadRoutes: vi.fn().mockResolvedValue([]),
  loadApprovalContacts: vi.fn().mockResolvedValue([]),
  submit: vi.fn(),
  act: vi.fn(),
  addItemNote: vi.fn(),
  details: vi.fn().mockResolvedValue({ history: [], notifications: [] }),
  receiptUrl: vi.fn(),
  archiveUrl: vi.fn(),
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Test data only. None of these people or requests exist.
const REVIEWER = "+14045550001";
const TREASURER = "+14045550003";
const MEMBER = "+14045550002";
const staff = [
  { email: REVIEWER, name: "Test Reviewer", role: "board" },
  { email: MEMBER, name: "Test Member", role: "board" },
  { email: TREASURER, name: "Test Treasurer", role: "treasurer" },
];
const request = {
  id: "11111111-1111-4111-8111-111111111111",
  reference: 901,
  version: 1,
  email: "parent@example.test",
  requester_name: "Test Parent",
  payee: "Test Parent",
  committee: "Fall Event",
  request_type: "reimbursement",
  purpose: "Supplies for a test event",
  delivery: "zelle",
  status: "submitted",
  approver_email: REVIEWER,
  routed_approval: true,
  total_cents: 62753,
  approved_cents: null,
  approved_amount_reason: "",
  created_at: "2026-11-10T15:00:00Z",
  items: [],
};
const approved = {
  ...request,
  version: 2,
  status: "approved",
  approved_cents: 61905,
  approved_amount_reason: "Only $619.05 remains in the event budget",
};
const userFor = (contact) => ({ id: "user", phone: contact.slice(1) });

let host, root, onError, onUpdate;
beforeEach(() => {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  onError = vi.fn();
  onUpdate = vi.fn();
  send.mockReset();
  send.mockImplementation(async (_action, data) => ({ ...request, ...data }));
  loadRoutes.mockResolvedValue([]);
});
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
async function open(record, role, contact) {
  await act(async () =>
    root.render(
      <Detail
        record={record}
        role={role}
        user={userFor(contact)}
        staff={staff}
        onBack={() => {}}
        onError={onError}
        onUpdate={onUpdate}
        onEdit={() => {}}
      />,
    ),
  );
}
const field = (label) =>
  [...host.querySelectorAll("label")]
    .find((l) => l.textContent.startsWith(label))
    ?.querySelector("input,textarea");
const button = (text) =>
  [...host.querySelectorAll("button")].find((b) => b.textContent.trim().startsWith(text));
function type(element, value) {
  const proto = element.tagName === "TEXTAREA" ? HTMLTextAreaElement : HTMLInputElement;
  act(() => {
    Object.getOwnPropertyDescriptor(proto.prototype, "value").set.call(element, value);
    element.dispatchEvent(new Event("input", { bubbles: true }));
  });
}
const click = (element) => act(async () => element.click());

describe("assigned reviewer approval", () => {
  it("approves the full requested amount by default", async () => {
    await open(request, "board", REVIEWER);
    expect(field("Amount to approve").value).toBe("627.53");
    expect(field("Reason for the lower amount")).toBeUndefined();
    await click(button("Approve $627.53"));
    expect(send).toHaveBeenCalledWith(
      "approved",
      expect.objectContaining({ id: request.id, approved_cents: 62753, amount_reason: "" }),
    );
    expect(onUpdate).toHaveBeenCalled();
  });
  it("approves a lower amount only once a reason is given", async () => {
    await open(request, "board", REVIEWER);
    type(field("Amount to approve"), "619.05");
    expect(button("Approve").disabled).toBe(true);
    expect(host.textContent).toContain("Add a short reason for approving less");
    type(field("Reason for the lower amount"), "Only $619.05 remains in the event budget");
    expect(button("Approve $619.05").disabled).toBe(false);
    await click(button("Approve $619.05"));
    expect(send).toHaveBeenCalledWith(
      "approved",
      expect.objectContaining({
        approved_cents: 61905,
        amount_reason: "Only $619.05 remains in the event budget",
      }),
    );
  });
  it("blocks zero, malformed and above-requested amounts", async () => {
    await open(request, "board", REVIEWER);
    for (const [value, message] of [
      ["0", "greater than zero"],
      ["abc", "greater than zero"],
      ["627.54", "cannot be more than the $627.53 requested"],
    ]) {
      type(field("Amount to approve"), value);
      expect(button("Approve").disabled).toBe(true);
      expect(host.textContent).toContain(message);
    }
    expect(send).not.toHaveBeenCalled();
  });
  it("offers no approval or amount field to anyone but the assigned reviewer", async () => {
    await open(request, "board", MEMBER);
    expect(field("Amount to approve")).toBeUndefined();
    expect(button("Approve")).toBeUndefined();
  });
});

describe("requested and approved amounts on the record", () => {
  it("shows both, with the reason, where they differ", async () => {
    await open(approved, "board", MEMBER);
    expect(host.textContent).toContain("Requested$627.53");
    expect(host.textContent).toContain("Approved");
    expect(host.textContent).toContain("$619.05");
    expect(host.textContent).toContain("Reason: Only $619.05 remains in the event budget");
  });
  it("shows a single total when approved in full", async () => {
    await open({ ...approved, approved_cents: 62753, approved_amount_reason: "" }, "board", MEMBER);
    expect(host.textContent).toContain("Total requested$627.53");
    expect(host.textContent).not.toContain("Reason:");
  });
  it("puts the approved amount on the payment screen", async () => {
    await open(approved, "treasurer", TREASURER);
    const card = host.querySelector(".payment-action-card");
    expect(card.textContent).toContain("$619.05 to Test Parent.");
    expect(card.textContent).toContain("The request was for $627.53.");
    expect(card.textContent).toContain("locks once payment is recorded");
  });
});

describe("correcting the approved amount before payment", () => {
  it("lets the treasurer correct it with a reason", async () => {
    await open(approved, "treasurer", TREASURER);
    expect(host.textContent).toContain("Correct the approved amount");
    expect(button("Save corrected amount").disabled).toBe(true);
    type(field("Corrected approved amount"), "600");
    expect(button("Save corrected amount").disabled).toBe(true);
    expect(host.textContent).toContain("Add a short reason for the correction");
    type(field("Reason for the correction"), "Budget recount after a late receipt.");
    await click(button("Save corrected amount"));
    expect(send).toHaveBeenCalledWith(
      "correct_amount",
      expect.objectContaining({
        id: approved.id,
        version: 2,
        approved_cents: 60000,
        amount_reason: "Budget recount after a late receipt.",
      }),
    );
  });
  it("rejects an unchanged or above-requested correction", async () => {
    await open(approved, "treasurer", TREASURER);
    type(field("Reason for the correction"), "Budget recount after a late receipt.");
    type(field("Corrected approved amount"), "619.05");
    expect(button("Save corrected amount").disabled).toBe(true);
    expect(host.textContent).toContain("Enter a different amount");
    type(field("Corrected approved amount"), "627.54");
    expect(button("Save corrected amount").disabled).toBe(true);
    expect(send).not.toHaveBeenCalled();
  });
  it("lets the committee's primary reviewer correct it", async () => {
    loadRoutes.mockResolvedValue([
      { committee: "Fall Event", request_type: "reimbursement", approver_email: REVIEWER },
    ]);
    await open(approved, "board", REVIEWER);
    expect(host.textContent).toContain("Correct the approved amount");
  });
  it("hides the correction from other board members and from the requester", async () => {
    loadRoutes.mockResolvedValue([
      { committee: "Fall Event", request_type: "reimbursement", approver_email: REVIEWER },
    ]);
    await open(approved, "board", MEMBER);
    expect(host.textContent).not.toContain("Correct the approved amount");
    await open({ ...approved, email: TREASURER }, "treasurer", TREASURER);
    expect(host.textContent).not.toContain("Correct the approved amount");
  });
  it("locks the amount once payment is recorded", async () => {
    await open(
      { ...approved, status: "paid", payment_reference: "TEST-REF", payment_date: "2026-11-11" },
      "treasurer",
      TREASURER,
    );
    expect(host.textContent).not.toContain("Correct the approved amount");
    expect(host.textContent).toContain("$619.05");
    expect(host.textContent).toContain("Requested$627.53");
  });
});

describe("totals", () => {
  it("uses the approved amount for the unpaid total and the queue row", async () => {
    await act(async () =>
      root.render(
        <RequestList
          records={[
            approved,
            { ...approved, id: "full", reference: 902, total_cents: 10000, approved_cents: 10000, approved_amount_reason: "" },
            // Paid, test and archived requests stay out of the unpaid total.
            { ...approved, id: "paid", reference: 903, status: "paid" },
            { ...approved, id: "test", reference: 904, is_test: true },
            { ...approved, id: "old", reference: 905, archived_at: "2026-11-01T00:00:00Z" },
          ]}
          board
          role="manager"
          contact={MEMBER}
          staff={staff}
          onSelect={() => {}}
          onRefresh={() => {}}
        />,
      ),
    );
    expect(host.textContent).toContain("Approved, unpaid$719.05");
    expect(host.textContent).toContain("Approved. Requested $627.53");
    expect(host.textContent).not.toContain("Approved. Requested $100.00");
  });
});
