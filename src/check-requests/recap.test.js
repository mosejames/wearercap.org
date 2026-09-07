import { it, expect } from "vitest";
import { requesterRecap } from "../../supabase/functions/check-request-notify/recap.ts";
const snapshot = {
  request: {
    id: "request-id",
    reference: 123,
    requester_name: "Sam Parent",
    payee: "Sam Parent",
    total_cents: 1250,
    delivery: "zelle",
    zelle_contact: "sam@example.test",
    committee: "Welcome",
    purpose: "Welcome event supplies",
    items: [
      {
        description: "Paper goods",
        date: "2026-09-07",
        amount_cents: 1250,
        receipts: [{}],
      },
    ],
  },
  event: { action: "submitted" },
};
it("thanks the requester and recaps expenses and Zelle details", () => {
  const body = requesterRecap(snapshot);
  for (const text of [
    "Thank you for submitting",
    "finance team",
    "Request #123",
    "$12.50",
    "Zelle",
    "sam@example.test",
    "Sam Parent",
    "Welcome event supplies",
    "Paper goods",
    "Past requests",
  ])
    expect(body).toContain(text);
});
it("shows mail details and uses the correct approval message", () => {
  const body = requesterRecap({
    ...snapshot,
    request: {
      ...snapshot.request,
      delivery: "mail",
      address: "123 Example Street",
    },
    event: { action: "approved", note: "Receipts reviewed." },
  });
  expect(body).toContain("Check by mail");
  expect(body).toContain("123 Example Street");
  expect(body).toContain("Payment has not yet been recorded");
  expect(body).not.toContain("Zelle email");
});
it("includes payment reference and date in the paid recap", () => {
  const body = requesterRecap({
    ...snapshot,
    request: {
      ...snapshot.request,
      delivery: "pickup",
      payment_reference: "CHECK-123",
      payment_date: "2026-09-07",
    },
    event: { action: "paid" },
  });
  expect(body).toContain("Payment has been recorded");
  expect(body).toContain("Check pickup at school");
  expect(body).toContain("CHECK-123");
});
it("does not claim an attachment when sending a status-only email", () => {
  const body = requesterRecap(
    { ...snapshot, event: { action: "assigned" } },
    false,
  );
  expect(body).toContain("assigned to a board member");
  expect(body).not.toContain("receipts are attached");
  expect(body).toContain("notification preference");
});

it("recaps unpaid vendor payments and budget confirmation", () => {
  const body = requesterRecap({
    ...snapshot,
    request: {
      ...snapshot.request,
      request_type: "vendor",
      budget_confirmed: true,
      delivery: "debit_card",
    },
  });
  expect(body).toContain("Direct payment to vendor");
  expect(body).toContain("Zelle unavailable");
  expect(body).toContain("Confirmed by requester");
  expect(body).not.toContain("reimbursement request");
});
