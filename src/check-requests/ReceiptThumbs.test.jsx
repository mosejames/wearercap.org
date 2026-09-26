// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, it, expect, vi } from "vitest";
import ReceiptThumbs from "./ReceiptThumbs.jsx";
import { receiptPreviewUrls } from "./api.js";
vi.mock("./api.js", () => ({ receiptPreviewUrls: vi.fn() }));
vi.mock("./pdfPreview.js", () => ({
  openPdf: vi.fn(() => Promise.reject(new Error("no pdf.js in tests"))),
  drawPage: vi.fn(),
}));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
afterEach(() => {
  act(() => root.unmount());
  host.remove();
  document.body.innerHTML = "";
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
  expect(receiptPreviewUrls).toHaveBeenLastCalledWith([
    "u/r/a.jpg",
    "u/r/b.pdf",
    "u/r/c.png",
  ]);
  expect(host.querySelectorAll("a")).toHaveLength(2);
  expect(host.textContent).toContain("+1");
});
it("says so when previews cannot load", async () => {
  receiptPreviewUrls.mockRejectedValue(new Error("nope"));
  await render({ receipts });
  expect(host.textContent).toContain("could not load");
});
it("opens a receipt in a lightbox and closes it on Escape or a tap outside", async () => {
  receiptPreviewUrls.mockResolvedValue({
    "u/r/a.jpg": "https://s/a",
    "u/r/b.pdf": "https://s/b",
    "u/r/c.png": "https://s/c",
  });
  await render({ receipts, labels: true });
  const first = host.querySelector("a");
  const click = new MouseEvent("click", { bubbles: true, cancelable: true });
  await act(async () => first.dispatchEvent(click));
  expect(click.defaultPrevented).toBe(true);
  let box = document.querySelector('[role="dialog"]');
  expect(box.textContent).toContain("dj-invoice.jpg");
  expect(box.textContent).toContain("1 of 3");
  expect(box.querySelector(".lightbox-img").getAttribute("src")).toBe("https://s/a");
  await act(async () => box.querySelector('[aria-label="Next receipt"]').click());
  box = document.querySelector('[role="dialog"]');
  expect(box.textContent).toContain("flyers.pdf");
  expect(box.querySelector(".lightbox-pdf")).not.toBeNull();
  await act(async () =>
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
  );
  expect(document.querySelector('[role="dialog"]')).toBeNull();
  await act(async () => host.querySelectorAll("a")[2].click());
  box = document.querySelector('[role="dialog"]');
  expect(box.textContent).toContain("poster.png");
  await act(async () => box.dispatchEvent(new MouseEvent("click", { bubbles: true })));
  expect(document.querySelector('[role="dialog"]')).toBeNull();
});
