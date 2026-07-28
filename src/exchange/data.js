import { supabase } from '../carpool/supabaseClient.js';

// ---------------------------------------------------------------------------
// All Supabase traffic for the Uniform Exchange lives here.
// ---------------------------------------------------------------------------

export async function listHolders() {
  const { data, error } = await supabase
    .from('ue_holders')
    .select('*')
    .order('name', { ascending: true });
  if (error) throw error;
  return data || [];
}

// A bin is joined to its holder here, so the rest of the app can keep reading
// bin.holder_name / bin.carline_days without caring that the person is now
// their own record.
export async function listBins(holders = null) {
  const [{ data, error }, hs] = await Promise.all([
    supabase.from('ue_bins').select('*').order('created_at', { ascending: true }),
    holders ? Promise.resolve(holders) : listHolders().catch(() => []),
  ]);
  if (error) throw error;
  const byId = new Map((hs || []).map((h) => [h.id, h]));
  return (data || []).map((b) => {
    const h = byId.get(b.holder_id);
    if (!h) return b;
    return {
      ...b,
      holder: h,
      holder_name: h.name,
      holder_house: h.house,
      holder_phone: h.phone,
      holder_email: h.email,
      holder_note: h.note,
      holder_student: h.student,
      offers_carline: h.offers_carline,
      offers_student: h.offers_student,
      carline_days: h.carline_days,
      carline_when: h.carline_when,
      carline_spot: h.carline_spot,
    };
  });
}

export async function listInventory() {
  const { data, error } = await supabase.from('ue_inventory').select('*');
  if (error) throw error;
  return data || [];
}

// Requests hold names, students and phone numbers, so they are not listable.
// This is the anonymous slice the matcher needs: what's already promised out
// of which bin, with no people attached.
export async function listCommitments() {
  const { data, error } = await supabase.from('ue_commitments').select('*');
  if (error) throw error;
  return data || [];
}

// Everything tied to one private token — that phone number's requests, and
// nothing else in the system.
export async function myRequests(token) {
  const { data, error } = await supabase.rpc('ue_my_requests', { p_token: token });
  if (error) throw error;
  return data || [];
}

// Lost the link: we text a fresh one. Says nothing about whether we know you.
export async function requestAccess(phone) {
  const { error } = await supabase.rpc('ue_request_access', { p_phone: phone });
  if (error) throw error;
}

// A bin holder's own queue, opened by the code on their QR label.
export async function binQueue(code) {
  const { data, error } = await supabase.rpc('ue_bin_queue', { p_code: code });
  if (error) throw error;
  return { requests: data?.requests || [], offers: data?.offers || [] };
}

// The back office, behind the passcode.
export async function adminData(pass) {
  const { data, error } = await supabase.rpc('ue_admin_data', { p_pass: pass });
  if (error) throw error;
  return {
    requests: data?.requests || [],
    offers: data?.offers || [],
    notifications: data?.notifications || [],
  };
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
  const { data, error } = await supabase.rpc('ue_create_request', {
    p_parent_name: form.parentName,
    p_contact: form.contact || '',
    p_student: form.student || '',
    p_item_type: form.itemType,
    p_size: form.size,
    p_house: form.house || '',
    p_requester_house: form.requesterHouse || '',
    p_qty: form.qty || 1,
    p_note: form.note || '',
    p_bin: binId, // null puts it on the waitlist
  });
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
    p_holder_email: fields.holderEmail ?? null,
    p_holder_phone: fields.holderPhone ?? null,
  });
  if (error) throw error;
  return data;
}

// ---------------------------------------------------------------------------
// Donation offers — "come pick up my clothes."
// ---------------------------------------------------------------------------
export async function addOffer(form, binId) {
  const { data, error } = await supabase.rpc('ue_create_offer', {
    p_parent_name: form.parentName,
    p_contact: form.contact || '',
    p_house: form.house || '',
    p_items_desc: form.itemsDesc,
    p_bin: binId,
  });
  if (error) throw error;
  return data;
}

export async function updateOffer(id, status, binId = null, note = null) {
  const { error } = await supabase.rpc('ue_offer_update', {
    p_id: id, p_status: status, p_bin: binId, p_note: note,
  });
  if (error) throw error;
}

export async function listItemTypes() {
  const { data, error } = await supabase
    .from('ue_item_types')
    .select('*')
    .order('sort', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function adminItemType(pass, id, fields = {}) {
  const { error } = await supabase.rpc('ue_admin_item_type', {
    p_pass: pass,
    p_id: id,
    p_label: fields.label ?? null,
    p_housed: fields.housed ?? null,
    p_hidden: fields.hidden ?? null,
    p_sort: fields.sort ?? null,
    p_size_set: fields.sizeSet ?? null,
  });
  if (error) throw error;
}

// ---------------------------------------------------------------------------
// Handoff — how the item actually changes hands.
// ---------------------------------------------------------------------------
export async function listSettings() {
  const { data, error } = await supabase.from('ue_settings').select('*');
  if (error) throw error;
  const out = {};
  (data || []).forEach((r) => { out[r.key] = r.value; });
  return out;
}

export async function adminSetting(pass, key, value) {
  const { error } = await supabase.rpc('ue_admin_setting', {
    p_pass: pass, p_key: key, p_value: value,
  });
  if (error) throw error;
}

export async function setAvailability(binId, f) {
  const { error } = await supabase.rpc('ue_bin_availability', {
    p_id: binId,
    p_offers_carline: f.offersCarline ?? null,
    p_offers_student: f.offersStudent ?? null,
    p_days: f.days ?? null,
    p_when: f.when ?? null,
    p_spot: f.spot ?? null,
    p_holder_student: f.holderStudent ?? null,
  });
  if (error) throw error;
}

export async function scheduleHandoff(id, mode, date = null, slot = '', student = null) {
  const { error } = await supabase.rpc('ue_handoff_schedule', {
    p_id: id, p_mode: mode, p_date: date, p_slot: slot, p_student: student,
  });
  if (error) throw error;
}

export async function handoffSent(id, actor = '') {
  const { error } = await supabase.rpc('ue_handoff_sent', { p_id: id, p_actor: actor });
  if (error) throw error;
}

export async function handoffReceived(id) {
  const { error } = await supabase.rpc('ue_handoff_received', { p_id: id });
  if (error) throw error;
}

export async function adminHolder(pass, action, id = null, f = {}) {
  const { data, error } = await supabase.rpc('ue_admin_holder', {
    p_pass: pass, p_action: action, p_id: id,
    p_name: f.name ?? null, p_phone: f.phone ?? null, p_email: f.email ?? null,
    p_house: f.house ?? null, p_student: f.student ?? null, p_note: f.note ?? null,
  });
  if (error) throw error;
  return data;
}

export async function setHolderAvailability(holderId, f) {
  const { error } = await supabase.rpc('ue_holder_availability', {
    p_id: holderId,
    p_offers_carline: f.offersCarline ?? null,
    p_offers_student: f.offersStudent ?? null,
    p_days: f.days ?? null,
    p_when: f.when ?? null,
    p_spot: f.spot ?? null,
    p_student: f.holderStudent ?? null,
  });
  if (error) throw error;
}

export async function adminBin2(pass, action, id = null, f = {}) {
  const { data, error } = await supabase.rpc('ue_admin_bin2', {
    p_pass: pass, p_action: action, p_id: id,
    p_code: f.code ?? null, p_name: f.name ?? null,
    p_holder_id: f.holderId ?? null, p_focus: f.focus ?? null,
  });
  if (error) throw error;
  return data;
}

export async function adminReassign(pass, id, binId) {
  const { error } = await supabase.rpc('ue_admin_reassign', {
    p_pass: pass, p_id: id, p_bin: binId,
  });
  if (error) throw error;
}

export async function adminRequest(pass, id, status = null, note = null) {
  const { error } = await supabase.rpc('ue_admin_request', {
    p_pass: pass, p_id: id, p_status: status, p_note: note,
  });
  if (error) throw error;
}
