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
function setup(receipts) {
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
        committee: "Other",
        purpose: "Supplies for school event",
        items: [
          {
            ...d.items[0],
            date: today(),
            description: "Supplies",
            amount: "12.50",
            receipts,
          },
        ],
      };
    });
    return (
      <RequestForm
        draft={draft}
        setDraft={setDraft}
        user={{ phone: "14045550123" }}
        staff={[]}
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
  act(() => panel().querySelector('input[type="checkbox"]').click());
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
    "Add a positive amount and at least one receipt to every expense.",
  );
});
