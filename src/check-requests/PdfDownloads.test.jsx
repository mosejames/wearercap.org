// @vitest-environment jsdom
import React, { act } from "react";
import { createRoot } from "react-dom/client";
import { afterEach, it, expect, vi } from "vitest";
import PdfDownloads from "./PdfDownloads.jsx";
import { details } from "./api.js";
vi.mock("./api.js", () => ({ details: vi.fn(), archiveUrl: vi.fn() }));
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
let root, host;
afterEach(() => {
  act(() => root.unmount());
  host.remove();
});
async function renderAndClick(notifications) {
  details.mockResolvedValue({ notifications });
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  act(() => root.render(<PdfDownloads requestId="request-123" />));
  await act(async () => host.querySelector("button").click());
}
it("offers all numbered parts of the latest available PDF from the dashboard", async () => {
  await renderAndClick([
    { archive_files: [{ path: "part1" }, { path: "part2" }] },
    { archive_files: [{ path: "older" }] },
  ]);
  expect(details).toHaveBeenCalledWith("request-123");
  expect(host.textContent).toContain("Download part 1");
  expect(host.textContent).toContain("Download part 2");
  expect(host.textContent).toContain("2 PDF parts");
});
it("explains when background processing has not finished", async () => {
  await renderAndClick([]);
  expect(host.textContent).toContain("still being prepared");
});
