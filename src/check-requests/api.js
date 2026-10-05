import { supabase } from "../carpool/supabaseClient.js";
import { normalizePhone, receiptMime, toCents } from "./model.js";
export { supabase };
export async function loadRequests() {
  const records = [];
  for (let from = 0; ; from += 500) {
    const { data, error } = await supabase
      .from("cr_requests")
      .select("*")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(from, from + 499);
    if (error) throw error;
    records.push(...data);
    if (data.length < 500) return records;
  }
}
export async function loadStaff() {
  const { data, error } = await supabase
    .from("cr_staff")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}
export async function loadApprovalContacts() {
  const { data, error } = await supabase.rpc("cr_approval_email_contacts");
  if (error) throw error;
  return data;
}
export async function loadRoutes() {
  const { data, error } = await supabase
    .from("cr_approval_routes")
    .select("committee,request_type,approver_email,backup_email,updated_at")
    .order("committee");
  if (error) throw error;
  return data;
}
export async function loadPaymentCommittees() {
  const { data, error } = await supabase
    .from("cr_payment_committees")
    .select("name")
    .order("name");
  if (error) throw error;
  return data.map((item) => item.name);
}
export async function addPaymentCommittee(name) {
  const { data, error } = await supabase.rpc("cr_add_payment_committee", {
    p_name: name,
  });
  if (error) throw error;
  return data;
}
export async function saveCommitteeAssignment(committee, draft) {
  const { data, error } = await supabase.rpc("cr_save_committee_assignment", {
    p_committee: committee,
    p_approver: draft.approver || null,
    p_backup: draft.backup || null,
    p_active: draft.active,
  });
  if (error) throw error;
  return data;
}
export async function act(action, data) {
  const r = await supabase.rpc("cr_action", { p_action: action, p_data: data });
  if (r.error) throw r.error;
  return r.data;
}
export async function submit(d, user, onProgress, canNotify = false) {
  const { approval_recipients, approval_recipients_text, ...request } = d;
  const items = [];
  for (const [i, item] of d.items.entries()) {
    const receipts = [];
    for (const receipt of item.receipts) {
      if (receipt.path) {
        receipts.push({ path: receipt.path, name: receipt.name });
        continue;
      }
      onProgress(`Uploading receipt for expense ${i + 1}…`);
      const contentType = await receiptMime(receipt.file);
      const path = `${user.id}/${d.id}/${crypto.randomUUID()}.${{ "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" }[contentType]}`;
      const { error } = await supabase.storage
        .from("check-receipts")
        .upload(path, receipt.file, {
          contentType,
          upsert: false,
        });
      if (error)
        throw new Error(
          "A receipt could not be uploaded. Check your connection and try again.",
        );
      // Keep successful uploads on a failed attempt, so retry does not duplicate them.
      receipt.path = path;
      receipts.push({ path, name: receipt.name });
    }
    items.push({
      date: item.date,
      vendor: d.request_type === "vendor" ? "" : (item.vendor || "").trim(),
      description: item.description.trim(),
      amount_cents: toCents(item.amount),
      document_total_cents: toCents(item.partial ? item.document_total : item.amount),
      coverage_note: item.partial ? (item.coverage_note || "").trim() : "",
      receipts,
    });
  }
  onProgress("Saving your request…");
  return act("submit", {
    ...request,
    ...(canNotify
      ? {
          approval_recipients: (approval_recipients_text || "")
            .split(/[,;\n]/)
            .map((e) => e.trim())
            .filter(Boolean),
        }
      : {}),
    payee_contact: d.on_behalf
      ? d.payee_contact.includes("@")
        ? d.payee_contact.trim().toLowerCase()
        : "+1" + normalizePhone(d.payee_contact)
      : "",
    archive_email: (d.archive_email || "").trim().toLowerCase(),
    phone: normalizePhone(d.phone),
    zelle_contact:
      d.delivery === "zelle"
        ? d.zelle_contact.includes("@")
          ? d.zelle_contact.trim().toLowerCase()
          : normalizePhone(d.zelle_contact)
        : "",
    items,
  });
}
export async function details(id) {
  const [h, n] = await Promise.all([
    supabase
      .from("cr_history")
      .select("*")
      .eq("request_id", id)
      .order("created_at"),
    supabase
      .from("cr_notifications")
      .select(
        "id,state,recipient,channel,sent_at,created_at,archive_files,last_error",
      )
      .eq("request_id", id)
      .order("created_at", { ascending: false }),
  ]);
  if (h.error || n.error) throw h.error || n.error;
  return { history: h.data, notifications: n.data };
}
export async function receiptUrl(path) {
  const { data, error } = await supabase.storage
    .from("check-receipts")
    .createSignedUrl(path, 120, { download: true });
  if (error) throw error;
  return data.signedUrl;
}
export async function archiveUrl(path) {
  const { data, error } = await supabase.storage
    .from("check-archives")
    .createSignedUrl(path, 120, { download: true });
  if (error) throw error;
  return data.signedUrl;
}
// Inline (not download) signed URLs so receipt images can render as thumbnails.
export async function receiptPreviewUrls(paths) {
  if (!paths.length) return {};
  const { data, error } = await supabase.storage
    .from("check-receipts")
    .createSignedUrls(paths, 600);
  if (error) throw error;
  return Object.fromEntries(
    data.filter((d) => d.signedUrl).map((d) => [d.path, d.signedUrl]),
  );
}
