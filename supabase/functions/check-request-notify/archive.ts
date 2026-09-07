import { summaryPdf, receiptPdf, mergePdfs } from "./pdf.ts";
import { requesterRecap } from "./recap.ts";
import { sendNotice } from "./send.ts";
export async function deliverArchive(job: any, db: any, config: any) {
  const snapshot = job.archive_snapshot;
  const r = snapshot.request;
  let files = job.archive_files;
  if (!files) {
    files = [];
    let parts = [await summaryPdf(snapshot)];
    let size = parts[0].length;
    async function flush() {
      const bytes = await mergePdfs(parts, snapshot);
      if (bytes.length > 18 * 1024 * 1024)
        throw new Error(
          "Archive part exceeds email limit. Staff assistance required.",
        );
      const filename = `RCAP-${r.reference}-v${r.version}-${snapshot.event.action}-part-${files.length + 1}.pdf`;
      const path = `${r.id}/${job.id}/${filename}`;
      const { error } = await db.storage
        .from("check-archives")
        .upload(path, bytes, { contentType: "application/pdf", upsert: true });
      if (error) throw new Error("Could not store the PDF archive.");
      files.push({ path, name: filename });
      parts = [];
      size = 0;
    }
    for (const [i, item] of r.items.entries())
      for (const [j, receipt] of item.receipts.entries()) {
        // Never fetch an arbitrary URL or another request's storage path.
        if (!receipt.path.startsWith(`${r.owner_id}/${r.id}/`))
          throw new Error("Invalid receipt archive path.");
        const { data, error } = await db.storage
          .from("check-receipts")
          .download(receipt.path);
        if (error || !data)
          throw new Error(`Could not read receipt ${i + 1}.${j + 1}.`);
        let bytes;
        try {
          bytes = await receiptPdf(
            new Uint8Array(await data.arrayBuffer()),
            receipt.path,
            `RCAP #${r.reference} | Document ${i + 1}.${j + 1}: ${receipt.name}`,
          );
        } catch {
          throw new Error(
            `Receipt ${i + 1}.${j + 1} could not be rendered. Staff assistance required.`,
          );
        }
        if (parts.length && size + bytes.length > 8 * 1024 * 1024)
          await flush();
        parts.push(bytes);
        size += bytes.length;
      }
    if (parts.length) await flush();
    const { error } = await db
      .from("cr_notifications")
      .update({ archive_files: files })
      .eq("id", job.id);
    if (error) throw new Error("Could not record the archive files.");
  }
  for (const [i, file] of files.entries()) {
    const { data, error } = await db.storage
      .from("check-archives")
      .download(file.path);
    if (error || !data) throw new Error("Could not read the stored archive.");
    const bytes = new Uint8Array(await data.arrayBuffer());
    let binary = "";
    for (let n = 0; n < bytes.length; n += 32768)
      binary += String.fromCharCode(...bytes.subarray(n, n + 32768));
    await sendNotice(
      {
        ...job,
        body:
          job.recipient === r.archive_email
            ? requesterRecap(snapshot)
            : job.body,
        id: `${job.id}-part-${i + 1}`,
        subject: `${job.subject} [${i + 1}/${files.length}]`,
        attachments: [{ filename: file.name, content: btoa(binary) }],
      },
      config,
    );
  }
}
