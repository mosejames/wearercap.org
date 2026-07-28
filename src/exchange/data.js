import { supabase } from '../carpool/supabaseClient.js';

// ---------------------------------------------------------------------------
// All Supabase traffic for the Uniform Exchange lives here.
// ---------------------------------------------------------------------------

export async function listBins() {
  const { data, error } = await supabase
    .from('ue_bins')
    .select('*')
    .order('created_at', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function listInventory() {
  const { data, error } = await supabase.from('ue_inventory').select('*');
  if (error) throw error;
  return data || [];
}

export async function listRequests() {
  const { data, error } = await supabase
    .from('ue_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

export async function listMovements(binId, limit = 30) {
  let q = supabase
    .from('ue_movements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(limit);
  if (binId) q = q.eq('bin_id', binId);
  const { data, error } = await q;
  if (error) throw error;
  return data || [];
}

// lines: [{ itemType, size, qty }], sign +1 for add, -1 for take out.
export async function logMovements(binId, lines, sign, actorName, note = '') {
  const rows = lines
    .filter((l) => l.qty > 0)
    .map((l) => ({
      bin_id: binId,
      item_type: l.itemType,
      size: l.size,
      house: l.house || '',
      qty_delta: sign * l.qty,
      kind: sign > 0 ? 'add' : 'remove',
      actor_name: (actorName || '').trim(),
      note: (note || '').trim(),
    }));
  if (!rows.length) return;
  const { error } = await supabase.from('ue_movements').insert(rows);
  if (error) throw error;
}

export async function addRequest(form, binId) {
  const { data, error } = await supabase
    .from('ue_requests')
    .insert({
      parent_name: form.parentName.trim(),
      contact: (form.contact || '').trim(),
      student: (form.student || '').trim(),
      item_type: form.itemType,
      size: form.size,
      house: form.house || '',
      qty: form.qty || 1,
      note: (form.note || '').trim(),
      bin_id: binId, // null puts it on the waitlist
    })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function fulfillRequest(id, actor = '') {
  const { error } = await supabase.rpc('ue_fulfill_request', { p_id: id, p_actor: actor });
  if (error) throw error;
}

export async function cancelRequest(id) {
  const { error } = await supabase.rpc('ue_cancel_request', { p_id: id });
  if (error) throw error;
}

export async function assignRequest(id, binId) {
  const { error } = await supabase.rpc('ue_assign_request', { p_id: id, p_bin: binId });
  if (error) throw error;
}

export async function adminBin(pass, action, id, fields = {}) {
  const { data, error } = await supabase.rpc('ue_admin_bin', {
    p_pass: pass,
    p_action: action,
    p_id: id,
    p_code: fields.code ?? null,
    p_name: fields.name ?? null,
    p_holder_name: fields.holderName ?? null,
    p_holder_house: fields.holderHouse ?? null,
    p_holder_note: fields.holderNote ?? null,
  });
  if (error) throw error;
  return data;
}
