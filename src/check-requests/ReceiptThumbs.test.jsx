// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, it, expect, vi } from "vitest";
import ReceiptThumbs from "./ReceiptThumbs.jsx";
import { receiptPreviewUrls } from "./api.js";
vi.mock("./api.js", () => ({ receiptPreviewUrls: vi.fn() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
async function render(props) {
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  await act(async () => root.render(<ReceiptThumbs {...props} />));
}
const receipts = [
  { path: "u/r/a.jpg", name: "dj-invoice.jpg" },
  { path: "u/r/b.pdf", name: "flyers.pdf" },
  { path: "u/r/c.png", name: "poster.png" },
];
it("shows image previews and a PDF tile, each as a link that opens the receipt", async () => {
  receiptPreviewUrls.mockResolvedValue({
    "u/r/a.jpg": "https://s/a",
    "u/r/b.pdf": "https://s/b",
    "u/r/c.png": "https://s/c",
  });
  await render({ receipts, labels: true });
  const links = [...host.querySelectorAll("a")];
  expect(links.map((a) => a.getAttribute("href"))).toEqual([
    "https://s/a",
    "https://s/b",
    "https://s/c",
  ]);
  expect(links.every((a) => a.target === "_blank")).toBe(true);
  expect(host.querySelectorAll("img")).toHaveLength(2);
  expect(host.textContent).toContain("PDF");
  expect(host.textContent).toContain("dj-invoice.jpg");
});
it("caps the board list at the limit and counts the rest", async () => {
  receiptPreviewUrls.mockResolvedValue({});
  await render({ receipts, limit: 2 });
  expect(receiptPreviewUrls).toHaveBeenLastCalledWith(["u/r/a.jpg", "u/r/b.pdf"]);
  expect(host.querySelectorAll("a")).toHaveLength(2);
  expect(host.textContent).toContain("+1");
});
it("says so when previews cannot load", async () => {
  receiptPreviewUrls.mockRejectedValue(new Error("nope"));
  await render({ receipts });
  expect(host.textContent).toContain("could not load");
});
