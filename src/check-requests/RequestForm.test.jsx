// @vitest-environment jsdom
import React, { act, useState } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, expect, it, vi } from "vitest";
import { RequestForm } from "./main.jsx";
import { newDraft, today } from "./model.js";

vi.mock("./api.js", () => ({
  supabase: {},
  loadRequests: vi.fn(),
  loadStaff: vi.fn(),
  loadApprovalContacts: vi.fn().mockResolvedValue([]),
  submit: vi.fn(),
  act: vi.fn(),
  details: vi.fn(),
  receiptUrl: vi.fn(),
  archiveUrl: vi.fn(),
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
afterEach(() => {
  act(() => root?.unmount());
  host?.remove();
});
function setup(receipts, overrides = {}, staff = []) {
  host = document.createElement("div");
  document.body.append(host);
  const onError = vi.fn();
  function Harness() {
    const [draft, setDraft] = useState(() => {
      const d = newDraft();
      return {
        ...d,
        requester_name: "Test Parent",
        payee: "Test Parent",
        phone: "4045550123",
        zelle_contact: "4045550123",
        committee: "Other",
        purpose: "Supplies for school event",
        items: [
          {
            ...d.items[0],
            date: today(),
            vendor: "Party City",
            description: "Supplies",
            amount: "12.50",
            document_total: "12.50",
            receipts,
          },
        ],
        ...overrides,
      };
    });
    return (
      <RequestForm
        draft={draft}
        setDraft={setDraft}
        user={{ phone: "14045550123" }}
        staff={staff}
        onSaved={vi.fn()}
        onError={onError}
        busy={false}
        setBusy={vi.fn()}
      />
    );
  }
  root = createRoot(host);
  act(() => root.render(<Harness />));
  return onError;
}
const advance = () =>
  act(() =>
    host
      .querySelector("form")
      .dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })),
  );
const panel = () => host.querySelector(".wizard-panel:not([hidden])");
it("keeps receipts when moving between steps and requires final confirmation", () => {
  setup([
    {
      name: "receipt.jpg",
      file: new File(["receipt"], "receipt.jpg", { type: "image/jpeg" }),
    },
  ]);
  expect(panel().textContent).toContain("What were these expenses for?");
  expect(document.activeElement).toBe(document.body);
  advance();
  expect(panel().textContent).toContain("Expense 1");
  advance();
  expect(panel().textContent).toContain("receipt.jpg");
  expect(panel().textContent).toContain("$12.50");
  expect(host.querySelector("form").checkValidity()).toBe(false);
  act(() =>
    panel()
      .querySelectorAll('input[type="checkbox"]')
      .forEach((box) => box.click()),
  );
  expect(host.querySelector("form").checkValidity()).toBe(true);
  act(() =>
    [...host.querySelectorAll("button")]
      .find((b) => b.textContent.includes("Back"))
      .click(),
  );
  expect(panel().textContent).toContain("receipt.jpg");
  expect(
    [...host.querySelectorAll(".wizard-panel[hidden]")].every(
      (p) => p.disabled,
    ),
  ).toBe(true);
});
it("blocks review when an expense has no receipt", () => {
  const onError = setup([]);
  advance();
  advance();
  expect(panel().textContent).toContain("Expense 1");
  expect(onError).toHaveBeenLastCalledWith(
    "Add supporting documents, a supported requested amount, and an explanation for any amount RCAP is not covering.",
  );
});

it("requires an explicit reviewer for staff-prepared requests", () => {
  const error = setup(
    [{ name: "receipt.pdf", path: "receipt.pdf" }],
    { on_behalf: true, payee_contact: "crystal@example.test" },
    [{ email: "+14045550123", name: "Latasha", role: "treasurer" }],
  );
  advance();
  expect(error).toHaveBeenLastCalledWith(
    "Choose an approver and enter the payee email or cellphone.",
  );
  expect(panel().textContent).toContain("Send approval request to");
});
it("shows the exact RCAP share, coverage note, reviewer and email circulation before sending", () => {
  setup(
    [],
    {
      on_behalf: true,
      payee: "Crystal",
      payee_contact: "crystal@example.test",
      approver_email: "mose@example.test",
      event_name: "Parent Social",
      approval_recipients_text: "chair@example.test",
      items: [
        {
          key: "catering",
          date: today(),
          vendor: "Caterer",
          description: "Catering",
          amount: "500",
          document_total: "832.32",
          coverage_note: "Crystal and Mose each plan to cover $166.16.",
          receipts: [{ name: "receipt.pdf", path: "receipt.pdf" }],
        },
      ],
    },
    [
      { email: "+14045550123", name: "Latasha", role: "treasurer" },
      { email: "mose@example.test", name: "Mose", role: "manager" },
    ],
  );
  advance();
  expect(panel().textContent).toContain("$332.32");
  advance();
  for (const value of [
    "$832.32",
    "$500.00",
    "$166.16",
    "Mose",
    "Parent Social",
  ])
    expect(panel().textContent).toContain(value);
  expect(host.textContent).toContain("Send to Mose for approval");
  expect(panel().textContent).toContain("Addresses are visible");
});
