// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { expect, it, vi } from "vitest";
import ApprovalRecipients from "./ApprovalRecipients.jsx";

vi.mock("./api.js", () => ({
  loadApprovalContacts: vi.fn().mockResolvedValue([
    { name: "Crystal Jones", email: "crystal@example.test", automatic: false },
    { name: "Farren Salter", email: "farren@example.test", automatic: false },
    { name: "Latasha Emeri", email: "latasha@example.test", automatic: true },
    { name: "Mose James", email: "mose@example.test", automatic: true },
  ]),
}));

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

it("highlights the saved first recipient and keeps automatic recipients fixed", async () => {
  const host = document.createElement("div");
  document.body.append(host);
  const root = createRoot(host);
  const onChange = vi.fn();
  await act(async () =>
    root.render(
      <ApprovalRecipients
        value={["crystal@example.test"]}
        onChange={onChange}
      />,
    ),
  );
  const boxes = [...host.querySelectorAll('input[type="checkbox"]')];
  expect(boxes).toHaveLength(4);
  expect(boxes.map((box) => box.checked)).toEqual([true, false, true, true]);
  expect(boxes.map((box) => box.disabled)).toEqual([false, false, true, true]);
  expect(boxes[0].closest("label").classList.contains("selected")).toBe(true);
  await act(async () => boxes[1].click());
  expect(onChange).toHaveBeenCalledWith([
    "crystal@example.test",
    "farren@example.test",
  ]);
  act(() => root.unmount());
  host.remove();
});
