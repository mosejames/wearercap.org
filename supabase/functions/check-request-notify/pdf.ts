import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const money = (n: number) => "$" + (Number(n) / 100).toFixed(2);
// Standard PDF fonts support Western characters; unsupported characters are
// represented explicitly, and the untouched source record is attached as JSON.
const clean = (v: unknown) =>
  String(v ?? "")
    .replace(/[\r\n\t]+/g, " ")
    .replace(/[\u2010-\u2015]/g, "-")
    .replace(/[^\x20-\x7e\xa0-\xff]/g, "?");
export async function summaryPdf(snapshot: any) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const r = snapshot.request;
  doc.setTitle(`RCAP request ${r.reference} - ${snapshot.event.action}`);
  doc.setCreationDate(new Date(snapshot.event.created_at));
  doc.setModificationDate(new Date(snapshot.event.created_at));
  let page: any,
    y = 0;
  function next() {
    page = doc.addPage([612, 792]);
    y = 728;
    page.drawText("RCAP / PAYMENT REQUEST RECORD", {
      x: 44,
      y,
      size: 11,
      font: bold,
      color: rgb(0.16, 0.32, 0.4),
    });
    y -= 36;
  }
  function line(value: unknown, strong = false, size = 11) {
    const f = strong ? bold : font;
    const words = clean(value).split(/\s+/);
    let row = "";
    function draw() {
      if (y < 65) next();
      page.drawText(row, { x: 44, y, size, font: f });
      y -= size + 6;
      row = "";
    }
    for (const word of words) {
      for (const char of (row ? " " : "") + word) {
        if (f.widthOfTextAtSize(row + char, size) > 524) draw();
        row += char;
      }
    }
    if (row) draw();
    y -= 4;
  }
  next();
  line(`Request #${r.reference}`, true, 22);
  line(
    `${snapshot.event.action.replaceAll("_", " ").toUpperCase()} | Version ${r.version}`,
    true,
  );
  line(`Record date: ${snapshot.event.created_at}`);
  line(`Submitted: ${r.created_at}`);
  line(`Requester: ${r.requester_name}`);
  line(`Contact: ${r.phone}`);
  line(
    `Request type: ${r.request_type === "vendor" ? "Direct payment to vendor" : "Reimbursement"}`,
  );
  line(
    `Within budget: ${r.budget_confirmed ? "Confirmed by requester" : "Not recorded on this version"}`,
  );
  line(`Payee: ${r.payee}`);
  line(`Committee: ${r.committee}`);
  line(
    `Payment preference: ${{ mail: "Mail", pickup: "Pickup at school", zelle: "Zelle", debit_card: "Vendor debit card payment (Zelle unavailable)" }[r.delivery] || r.delivery}`,
  );
  if (r.delivery === "mail") line(`Mailing address: ${r.address}`);
  if (r.delivery === "zelle") line(`Zelle contact: ${r.zelle_contact}`);
  line(`Purpose: ${r.purpose}`);
  line(`Total requested: ${money(r.total_cents)}`, true, 15);
  line("EXPENSES", true);
  r.items.forEach((item: any, i: number) => {
    line(
      `${i + 1}. ${item.description} | ${item.date} | ${money(item.amount_cents)}`,
      true,
    );
    if (item.document_total_cents)
      line(`Supporting document total: ${money(item.document_total_cents)}`);
    item.receipts.forEach((receipt: any, j: number) =>
      line(`Document ${i + 1}.${j + 1}: ${receipt.name}`),
    );
  });
  line("APPROVAL AND PAYMENT HISTORY", true);
  for (const event of snapshot.history) {
    line(
      `${event.created_at} | ${event.action.replaceAll("_", " ")} | ${event.actor_email}`,
      true,
    );
    if (event.note) line(event.note);
  }
  if (r.payment_reference) line(`Payment reference: ${r.payment_reference}`);
  if (r.payment_date) line(`Payment date: ${r.payment_date}`);
  line(
    r.request_type === "vendor"
      ? "The requester certified that the RCAP invoice remains unpaid and supports the requested amount. Assigned Board Member approval is required before vendor payment."
      : "The requester certified that RCAP expenses were paid and have not already been reimbursed. Paid receipts support the request. Assigned Board Member approval is required; committee funds are not advanced.",
  );
  line(
    "Archive copy. Supporting document pages follow, or arrive as numbered companion parts for larger requests. Keep all parts together.",
  );
  for (const [i, p] of doc.getPages().entries())
    p.drawText(
      `RCAP #${r.reference} | Summary ${i + 1} of ${doc.getPageCount()}`,
      { x: 44, y: 30, size: 9, font },
    );
  await doc.attach(
    new TextEncoder().encode(JSON.stringify(snapshot, null, 2)),
    `RCAP-${r.reference}-record.json`,
    {
      mimeType: "application/json",
      description: "Complete request and history snapshot",
    },
  );
  return doc.save();
}
export async function receiptPdf(
  bytes: Uint8Array,
  path: string,
  label: string,
) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  if (path.toLowerCase().endsWith(".pdf")) {
    const source = await PDFDocument.load(bytes);
    // Flatten form field appearances before embedding, keeping the archive static.
    if (source.getForm().getFields().length) source.getForm().flatten();
    for (const sourcePage of source.getPages()) {
      if (!sourcePage.node.Contents()) sourcePage.drawText(" ");
      const embedded = await doc.embedPage(sourcePage);
      const page = doc.addPage([612, 792]);
      const scale = Math.min(524 / embedded.width, 680 / embedded.height);
      page.drawPage(embedded, {
        x: (612 - embedded.width * scale) / 2,
        y: 45,
        width: embedded.width * scale,
        height: embedded.height * scale,
      });
      page.drawText(clean(label).slice(0, 95), {
        x: 44,
        y: 752,
        size: 9,
        font,
      });
    }
  } else {
    const img = path.toLowerCase().endsWith(".png")
      ? await doc.embedPng(bytes)
      : await doc.embedJpg(bytes);
    const page = doc.addPage([612, 792]);
    const scale = Math.min(524 / img.width, 680 / img.height);
    page.drawImage(img, {
      x: (612 - img.width * scale) / 2,
      y: 45,
      width: img.width * scale,
      height: img.height * scale,
    });
    page.drawText(clean(label).slice(0, 95), { x: 44, y: 752, size: 9, font });
  }
  return doc.save();
}
export async function mergePdfs(parts: Uint8Array[], snapshot?: any) {
  const doc = await PDFDocument.create();
  if (snapshot)
    await doc.attach(
      new TextEncoder().encode(JSON.stringify(snapshot, null, 2)),
      `RCAP-${snapshot.request.reference}-record.json`,
      { mimeType: "application/json" },
    );
  for (const bytes of parts) {
    const source = await PDFDocument.load(bytes);
    for (const page of await doc.copyPages(source, source.getPageIndices()))
      doc.addPage(page);
  }
  return doc.save();
}
