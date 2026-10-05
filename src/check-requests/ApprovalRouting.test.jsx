// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { describe, expect, it, vi } from "vitest";
import ApprovalRouting, { boardReviewers } from "./ApprovalRouting.jsx";
import { addPaymentCommittee, loadRoutes, saveCommitteeAssignment } from "./api.js";

vi.mock("./api.js", () => ({
  loadRoutes: vi.fn().mockResolvedValue([]),
  saveCommitteeAssignment: vi.fn().mockResolvedValue({ saved: true }),
  addPaymentCommittee: vi.fn().mockResolvedValue("New Fundraiser"),
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const staff = [
  { name: "Mose James", email: "mose@example.test", role: "manager" },
  { name: "Mose James", email: "+14045550111", role: "manager" },
  { name: "Crystal Jones", email: "+14045550222", role: "board" },
  { name: "Latasha Emeri", email: "+14045550333", role: "treasurer" },
  { name: "RCA Parents", email: "team@example.test", role: "board" },
];

describe("committee reviewer settings", () => {
  it("shows one choice per board person and excludes the treasurer", () => {
    expect(boardReviewers(staff).map((person) => person.name)).toEqual([
      "Crystal Jones", "Mose James",
    ]);
    expect(boardReviewers(staff).find((person) => person.name === "Mose James")?.email)
      .toBe("+14045550111");
  });

  it("saves one committee assignment for both payment types", async () => {
    vi.clearAllMocks();
    loadRoutes.mockResolvedValue([]);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    try {
      await act(async () => { root.render(<ApprovalRouting staff={staff} />); });
      const form = [...host.querySelectorAll("form")]
        .find((node) => node.textContent.includes("Fall Raffle"));
      expect(form).toBeTruthy();
      const on = form.querySelector('input[type="checkbox"]');
      await act(async () => { on.click(); });
      const primary = form.querySelector('select[aria-label="Fall Raffle primary reviewer"]');
      await act(async () => {
        primary.value = "+14045550222";
        primary.dispatchEvent(new Event("change", { bubbles: true }));
      });
      await act(async () => { form.querySelector("button").click(); });
      expect(saveCommitteeAssignment).toHaveBeenCalledWith("Fall Raffle", {
        active: true,
        approver: "+14045550222",
        backup: "",
      });
    } finally {
      await act(async () => { root.unmount(); });
      host.remove();
    }
  });

  it("adds a payment committee and offers it for reviewer assignment", async () => {
    vi.clearAllMocks();
    loadRoutes.mockResolvedValue([]);
    const host = document.createElement("div");
    document.body.append(host);
    const root = createRoot(host);
    function Harness() {
      const [committees, setCommittees] = React.useState(["Fall Raffle"]);
      return <ApprovalRouting staff={staff} committees={committees}
        onCommitteeAdded={(name) => setCommittees((names) => [...names, name])} />;
    }
    try {
      await act(async () => { root.render(<Harness />); });
      const input = host.querySelector('.committee-add input');
      await act(async () => {
        Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, "New Fundraiser");
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
      await act(async () => { host.querySelector('.committee-add button').click(); });
      expect(addPaymentCommittee).toHaveBeenCalledWith("New Fundraiser");
      expect(host.textContent).toContain("New Fundraiser added");
      expect(host.querySelector('select[aria-label="New Fundraiser primary reviewer"]')).toBeTruthy();
    } finally {
      await act(async () => { root.unmount(); });
      host.remove();
    }
  });
});
