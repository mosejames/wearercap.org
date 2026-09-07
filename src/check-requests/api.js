import { supabase } from "../carpool/supabaseClient.js";
import { normalizePhone, toCents } from "./model.js";
export { supabase };
export async function loadRequests() {
  const { data, error } = await supabase
    .from("cr_requests")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(500);
  if (error) throw error;
  return data;
}
export async function loadStaff() {
  const { data, error } = await supabase
    .from("cr_staff")
    .select("*")
    .order("name");
  if (error) throw error;
  return data;
}
export async function act(action, data) {
  const r = await supabase.rpc("cr_action", { p_action: action, p_data: data });
  if (r.error) throw r.error;
  return r.data;
}
export async function submit(d, user, onProgress) {
  const items = [];
  for (const [i, item] of d.items.entries()) {
    const receipts = [];
    for (const receipt of item.receipts) {
      if (receipt.path) {
        receipts.push({ path: receipt.path, name: receipt.name });
        continue;
      }
      onProgress(`Uploading receipt for expense ${i + 1}…`);
      const path = `${user.id}/${d.id}/${crypto.randomUUID()}.${{ "image/jpeg": "jpg", "image/png": "png", "application/pdf": "pdf" }[receipt.file.type]}`;
      const { error } = await supabase.storage
        .from("check-receipts")
        .upload(path, receipt.file, {
          contentType: receipt.file.type,
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
      description: item.description.trim(),
      amount_cents: toCents(item.amount),
      receipts,
    });
  }
  onProgress("Saving your request…");
  return act("submit", {
    ...d,
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
      .select("id,state,recipient,channel,sent_at,created_at")
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
