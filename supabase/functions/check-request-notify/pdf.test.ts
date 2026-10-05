import { describe, expect, it } from "vitest";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import { receiptPdf } from "./pdf.ts";

describe("receipt PDF rendering", () => {
  it("uses image bytes when the filename has the wrong extension", async () => {
    const png = await sharp({
      create: { width: 2, height: 2, channels: 3, background: "#ffffff" },
    }).png().toBuffer();
    const output = await receiptPdf(new Uint8Array(png), "test-receipt.jpg", "TEST receipt");
    expect((await PDFDocument.load(output)).getPageCount()).toBe(1);

    const jpg = await sharp(png).jpeg().toBuffer();
    const other = await receiptPdf(new Uint8Array(jpg), "test-receipt.png", "TEST receipt");
    expect((await PDFDocument.load(other)).getPageCount()).toBe(1);
  });

  it("keeps PDF receipts and rejects unsupported content", async () => {
    const source = await PDFDocument.create();
    source.addPage();
    const output = await receiptPdf(await source.save(), "receipt.jpg", "TEST receipt");
    expect((await PDFDocument.load(output)).getPageCount()).toBe(1);
    await expect(receiptPdf(new Uint8Array([1, 2, 3]), "receipt.png", "TEST"))
      .rejects.toThrow("Unsupported receipt file content");
  });
});
