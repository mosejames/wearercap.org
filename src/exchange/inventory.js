// ---------------------------------------------------------------------------
// Pure inventory math. Movements in, useful shapes out. No Supabase here so
// all of it is unit-testable. An item is type + size + house ('' = any house).
// ---------------------------------------------------------------------------

const key = (t, s, h) => `${t}|${s}|${h || ''}`;

// rows: [{ bin_id, item_type, size, house, qty }] from the ue_inventory view.
// Returns Map binId -> Map key -> { itemType, size, house, qty }.
export function byBin(rows) {
  const out = new Map();
  for (const r of rows || []) {
    if (!out.has(r.bin_id)) out.set(r.bin_id, new Map());
    const k = key(r.item_type, r.size, r.house);
    out.get(r.bin_id).set(k, {
      itemType: r.item_type, size: r.size, house: r.house || '', qty: r.qty,
    });
  }
  return out;
}

// Site-wide totals per item/size/house, floored at zero per bin so one bin's
// drift below zero never eats another bin's real stock.
export function totals(rows) {
  const agg = new Map();
  for (const r of rows || []) {
    const q = Math.max(0, r.qty);
    if (q === 0) continue;
    const k = key(r.item_type, r.size, r.house);
    const cur = agg.get(k) || {
      itemType: r.item_type, size: r.size, house: r.house || '', qty: 0, bins: [],
    };
    cur.qty += q;
    cur.bins.push({ binId: r.bin_id, qty: q });
    agg.set(k, cur);
  }
  return [...agg.values()].sort(
    (a, b) =>
      a.itemType.localeCompare(b.itemType) ||
      (a.house || '').localeCompare(b.house || '') ||
      a.size.localeCompare(b.size)
  );
}

// Which bin should take a new request? Relationships first: the requester's
// own house bin whenever it has the item (that's how the swap has always
// worked — you link up with your house), otherwise the deepest bin anywhere.
// Stock already promised to other assigned requests doesn't count.
export function pickBin(rows, openAssigned, itemType, size, house, qty = 1, preferredBinIds = []) {
  const h = house || '';
  const preferred = new Set(preferredBinIds || []);
  const owed = new Map();
  for (const r of openAssigned || []) {
    if (r.status !== 'assigned' || r.item_type !== itemType || r.size !== size) continue;
    if ((r.house || '') !== h) continue;
    owed.set(r.bin_id, (owed.get(r.bin_id) || 0) + r.qty);
  }
  let best = null;
  let bestPreferred = null;
  for (const r of rows || []) {
    if (r.item_type !== itemType || r.size !== size || (r.house || '') !== h) continue;
    const free = Math.max(0, r.qty) - (owed.get(r.bin_id) || 0);
    if (free < qty) continue;
    if (!best || free > best.free) best = { binId: r.bin_id, free };
    if (preferred.has(r.bin_id) && (!bestPreferred || free > bestPreferred.free)) {
      bestPreferred = { binId: r.bin_id, free };
    }
  }
  const pick = bestPreferred || best;
  return pick ? pick.binId : null;
}

// Bins whose raw sum went negative — the drift the admin page surfaces.
export function drift(rows) {
  return (rows || []).filter((r) => r.qty < 0);
}
