// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import { RequestList } from "./main.jsx";
vi.mock("./ReceiptThumbs.jsx", () => ({ default: () => null }));
vi.mock("./PdfDownloads.jsx", () => ({ default: () => null }));
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
it("shows only actionable requests assigned to this reviewer in the approval queue", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const row = {
    email: "latasha@example.test",
    on_behalf: true,
    payee_contact: "crystal@example.test",
    approver_email: "mose@example.test",
    status: "submitted",
    created_at: "2026-09-28",
    committee: "General RCAP",
    requester_name: "Latasha",
    total_cents: 50000,
    items: [],
  };
  try {
    act(() =>
      root.render(
        <RequestList
          records={[
            { ...row, id: "1", reference: 1, payee: "For Mose" },
            {
              ...row,
              id: "2",
              reference: 2,
              payee: "For someone else",
              approver_email: "other@example.test",
            },
            {
              ...row,
              id: "3",
              reference: 3,
              payee: "Already approved",
              status: "approved",
            },
          ]}
          board
          approvalsOnly
          role="manager"
          contact="mose@example.test"
          onSelect={() => {}}
          onNew={() => {}}
          onRefresh={() => {}}
          loading={false}
        />,
      ),
    );
    expect(host.textContent).toContain("For Mose");
    expect(host.textContent).not.toContain("For someone else");
    expect(host.textContent).not.toContain("Already approved");
    expect(host.textContent).toContain("$500.00");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});

it("excludes archived records from totals and reveals them only in Archived", () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const base = {
    status: "approved",
    total_cents: 50000,
    items: [],
    created_at: "2026-09-29",
    requester_name: "Parent",
    committee: "General",
    purpose: "Catering",
  };
  try {
    act(() =>
      root.render(
        <RequestList
          records={[
            { ...base, id: "active", reference: 1, payee: "Active payee" },
            {
              ...base,
              id: "archived",
              reference: 2,
              payee: "Archived test",
              total_cents: 100,
              archived_at: "2026-09-29",
            },
          ]}
          board
          role="manager"
          contact="reviewer"
          onSelect={() => {}}
          onRefresh={() => {}}
        />,
      ),
    );
    expect(host.textContent).toContain("Approved, unpaid$500.00");
    expect(host.textContent).not.toContain("Archived test");
    expect(host.textContent).not.toContain("Open request");
    act(() =>
      [...host.querySelectorAll("button")]
        .find((b) => b.textContent === "View")
        .click(),
    );
    expect(host.textContent).toContain("Open request");
    act(() => {
      const select = host.querySelector("select");
      select.value = "archived";
      select.dispatchEvent(new Event("change", { bubbles: true }));
    });
    expect(host.textContent).toContain("Archived test");
    expect(host.textContent).not.toContain("Active payee");
  } finally {
    act(() => root.unmount());
    host.remove();
  }
});
