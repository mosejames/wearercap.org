import { zipSync, strToU8 } from "fflate";
import { supabase } from "./api.js";

const PAGE_SIZE = 500;

async function allRows(table, order = "created_at") {
  const rows = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const { data, error } = await supabase
      .from(table)
      .select("*")
      .order(order, { ascending: true })
      .order("id", { ascending: true })
      .range(from, from + PAGE_SIZE - 1);
    if (error) throw error;
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}

const spreadsheetCell = (value) => {
  const s = value == null ? "" : String(value);
  const safe = /^[\s]*[=+@-]/.test(s) ? `'${s}` : s;
  return `"${safe.replaceAll('"', '""')}"`;
};

export function csv(rows, fields) {
  return [fields.join(","), ...rows.map((row) => fields.map((field) => spreadsheetCell(row[field])).join(","))].join("\r\n") + "\r\n";
}

const fileName = (name) => String(name || "file")
  .replace(/[\\/\u0000-\u001f:]/g, "_")
  .slice(0, 120);

export async function financeArchive(onProgress = () => {}) {
  onProgress("Loading the complete request history…");
  const [requests, history, notifications, routeChanges] = await Promise.all([
    allRows("cr_requests"),
    allRows("cr_history"),
    allRows("cr_notifications"),
    allRows("cr_approval_route_history"),
  ]);
  const files = {
    "requests.csv": [strToU8(csv(requests, ["reference", "id", "created_at", "updated_at", "requester_name", "email", "payee", "committee", "event_name", "request_type", "purpose", "total_cents", "status", "approver_email", "payment_date", "payment_reference", "archived_at"]))],
    "history.csv": [strToU8(csv(history, ["id", "request_id", "created_at", "actor_email", "action", "note"]))],
    "notifications.csv": [strToU8(csv(notifications, ["id", "request_id", "created_at", "channel", "recipient", "state", "sent_at", "last_error"]))],
    "route-changes.csv": [strToU8(csv(routeChanges, ["created_at", "committee", "request_type", "old_approver", "new_approver", "actor_email"]))],
    "records.json": [strToU8(JSON.stringify({ exported_at: new Date().toISOString(), requests, history, notifications, routeChanges }, null, 2))],
  };
  const seen = new Set();
  const documents = [];
  for (const request of requests) {
    for (const item of request.items || []) {
      for (const receipt of item.receipts || []) {
        if (!receipt.path || seen.has(`check-receipts:${receipt.path}`)) continue;
        seen.add(`check-receipts:${receipt.path}`);
        documents.push({ bucket: "check-receipts", path: receipt.path, name: `documents/request-${request.reference}/${fileName(receipt.path.split("/").pop())}-${fileName(receipt.name || "receipt")}` });
      }
    }
  }
  for (const notification of notifications) {
    for (const archived of notification.archive_files || []) {
      if (!archived.path || seen.has(`check-archives:${archived.path}`)) continue;
      seen.add(`check-archives:${archived.path}`);
      const request = requests.find((r) => r.id === notification.request_id);
      documents.push({ bucket: "check-archives", path: archived.path, name: `documents/request-${request?.reference || notification.request_id}/archive-${fileName(archived.path.split("/").pop())}-${fileName(archived.name || "record.pdf")}` });
    }
  }
  for (const [index, document] of documents.entries()) {
    onProgress(`Downloading document ${index + 1} of ${documents.length}…`);
    const { data, error } = await supabase.storage.from(document.bucket).download(document.path);
    if (error) throw new Error(`Could not download ${document.name}. Export stopped so the archive is not incomplete.`);
    files[document.name] = [new Uint8Array(await data.arrayBuffer())];
  }
  onProgress("Preparing the download…");
  return zipSync(files, { level: 0 });
}

export function saveFinanceArchive(bytes) {
  const date = new Date().toISOString().slice(0, 10);
  const blob = new Blob([bytes], { type: "application/zip" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `rcap-finance-records-${date}.zip`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 60000);
}
