// @vitest-environment node
import { it, expect, vi } from "vitest";
import { PDFDocument, PDFName } from "pdf-lib";
import {
  summaryPdf,
  receiptPdf,
  mergePdfs,
} from "../../supabase/functions/check-request-notify/pdf.ts";
import { deliverArchive } from "../../supabase/functions/check-request-notify/archive.ts";
const snapshot = {
  request: {
    id: "request",
    owner_id: "owner",
    reference: 123,
    version: 1,
    requester_name: "Sample Parent",
    phone: "4045550123",
    payee: "Sample Parent",
    committee: "Welcome",
    delivery: "mail",
    address: "123 Example Street",
    purpose: "Welcome supplies",
    total_cents: 1250,
    created_at: "2026-09-07T12:00:00Z",
    items: [],
  },
  event: { action: "submitted", created_at: "2026-09-07T12:00:00Z" },
  history: [],
};
it("preserves all uploaded PDF pages and includes the exact snapshot in the archive", async () => {
  const receipt = await PDFDocument.create();
  receipt.addPage();
  receipt.addPage();
  const result = await mergePdfs(
    [
      await summaryPdf(snapshot),
      await receiptPdf(await receipt.save(), "receipt.pdf", "Receipt 1"),
    ],
    snapshot,
  );
  const doc = await PDFDocument.load(result);
  expect(doc.getPageCount()).toBe(3);
  expect(doc.catalog.has(PDFName.of("Names"))).toBe(true);
});
it("paginates long request records", async () => {
  const long = structuredClone(snapshot);
  long.request.purpose = "Long description ".repeat(300);
  long.history = Array.from({ length: 20 }, () => ({
    action: "needs_changes",
    created_at: "2026-09-07",
    actor_email: "reviewer@example.test",
    note: "Detailed review ".repeat(30),
  }));
  expect(
    (await PDFDocument.load(await summaryPdf(long))).getPageCount(),
  ).toBeGreaterThan(5);
});
it("does not silently skip a corrupt PDF receipt", async () => {
  await expect(
    receiptPdf(new Uint8Array([1, 2]), "bad.pdf", "Receipt"),
  ).rejects.toThrow();
});
it("rejects receipt paths from another request before storage access", async () => {
  const data = structuredClone(snapshot);
  data.request.items = [{ receipts: [{ path: "someone/else/receipt.pdf" }] }];
  const from = vi.fn();
  await expect(
    deliverArchive({ archive_snapshot: data }, { storage: { from } }, {}),
  ).rejects.toThrow("Invalid receipt archive path");
  expect(from).not.toHaveBeenCalled();
});
it("keeps an uploaded image on exactly one page", async () => {
  const png = Uint8Array.from(
    Buffer.from(
      "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
      "base64",
    ),
  );
  expect(
    (
      await PDFDocument.load(
        await receiptPdf(png, "photo.png", "Receipt photo"),
      )
    ).getPageCount(),
  ).toBe(1);
});
