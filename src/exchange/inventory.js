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

// ---------------------------------------------------------------------------
// The whole cupboard, one shape: what exists, by house, down to the size, and
// which bin it's sitting in. Answers "do we have a 12 for an Amistad family,
// and who has it?" without opening seven bins one at a time.
//
// `promised` is stock already spoken for by a live request, so a shelf that
// looks full but is entirely owed reads honestly.
// `shortages` are sizes people are waiting on that nobody has — the reason to
// send a "does anyone have…" email.
// ---------------------------------------------------------------------------
const LIVE = ['assigned', 'scheduled', 'handed_off'];

export function stockByHouse(rows, bins = [], reqs = []) {
  const binById = new Map((bins || []).map((b) => [b.id, b]));

  const owed = new Map();
  const waiting = new Map();
  for (const r of reqs || []) {
    const k = key(r.item_type, r.size, r.house);
    const n = Math.max(1, r.qty || 1);
    if (LIVE.includes(r.status)) owed.set(k, (owed.get(k) || 0) + n);
    else if (r.status === 'open') waiting.set(k, (waiting.get(k) || 0) + n);
  }

  const houses = new Map();
  const house = (h) => {
    if (!houses.has(h)) {
      houses.set(h, { house: h, onHand: 0, promised: 0, types: new Map(), shortages: [] });
    }
    return houses.get(h);
  };

  for (const t of totals(rows)) {
    const H = house(t.house);
    const k = key(t.itemType, t.size, t.house);
    const promised = Math.min(t.qty, owed.get(k) || 0);
    H.onHand += t.qty;
    H.promised += promised;

    if (!H.types.has(t.itemType)) H.types.set(t.itemType, { itemType: t.itemType, qty: 0, sizes: [] });
    const T = H.types.get(t.itemType);
    T.qty += t.qty;
    T.sizes.push({
      size: t.size,
      qty: t.qty,
      promised,
      free: t.qty - promised,
      where: t.bins
        .map((b) => {
          const bin = binById.get(b.binId);
          return {
            binId: b.binId,
            qty: b.qty,
            code: bin?.code || '',
            name: bin?.name || '',
            holder: bin?.holder_name || '',
          };
        })
        .sort((a, b) => b.qty - a.qty || a.code.localeCompare(b.code)),
    });
  }

  // Anything on the waitlist that no bin can answer.
  const have = new Set(totals(rows).map((t) => key(t.itemType, t.size, t.house)));
  for (const [k, qty] of waiting) {
    if (have.has(k)) continue;
    const [itemType, size, h] = k.split('|');
    house(h).shortages.push({ itemType, size, qty });
  }

  return [...houses.values()]
    .map((h) => ({
      ...h,
      types: [...h.types.values()].sort((a, b) => a.itemType.localeCompare(b.itemType)),
      shortages: h.shortages.sort(
        (a, b) => a.itemType.localeCompare(b.itemType) || a.size.localeCompare(b.size)
      ),
    }))
    .sort((a, b) => (a.house === '' ? 1 : b.house === '' ? -1 : a.house.localeCompare(b.house)));
}

// Bins whose raw sum went negative — the drift the admin page surfaces.
export function drift(rows) {
  return (rows || []).filter((r) => r.qty < 0);
}

// ---------------------------------------------------------------------------
// The count sheet. A holder counting a bin sees every size an item comes in,
// pre-laid with whatever is counted now, and types over it — no dropdowns.
// These two turn that grid back into something the server can take.
// ---------------------------------------------------------------------------

// Everything stocked in this bin that the pre-laid grid does NOT cover: a size
// that's been retired since it was logged, or a housed item from a house other
// than the holder's. Without this, counting a bin would quietly drop whatever
// the sheet couldn't draw. Returns the same shape as a grid cell.
export function sheetExtras(rows, binId, covered) {
  const have = new Set(covered || []);
  return (rows || [])
    .filter((r) => r.bin_id === binId && r.qty !== 0)
    .filter((r) => !have.has(key(r.item_type, r.size, r.house)))
    .map((r) => ({
      itemType: r.item_type, size: r.size, house: r.house || '',
      qty: Math.max(0, r.qty), extra: true,
    }))
    .sort((a, b) =>
      a.itemType.localeCompare(b.itemType) ||
      (a.house || '').localeCompare(b.house || '') ||
      a.size.localeCompare(b.size));
}

// What to POST when the sheet is saved. `cells` is the whole grid the holder
// could touch — every size of every item, mostly zero.
//
// A size sitting at zero that was already zero is dropped: the server would
// compute a no-op delta anyway, and a full sheet is ~130 sizes, so sending
// them all would turn every save into a wall of nothing. A size that HAD
// stock and now reads zero is kept, because emptying a bin of one size is a
// real change and has to log its negative delta.
//
// Anything stocked but absent from `cells` is simply not mentioned, which
// leaves it untouched — that's what makes it safe for the sheet to render one
// item at a time.
export function sheetLines(cells, rows, binId) {
  const have = byBin(rows).get(binId) || new Map();
  const seen = new Set();
  const out = [];
  for (const c of cells || []) {
    if (!c || !c.itemType || !c.size) continue;
    const k = key(c.itemType, c.size, c.house);
    if (seen.has(k)) continue;
    seen.add(k);
    const qty = Math.max(0, Math.floor(Number(c.qty) || 0));
    const now = Math.max(0, have.get(k)?.qty || 0);
    if (qty === 0 && now === 0) continue;
    out.push({
      bin_id: binId, item_type: c.itemType, size: c.size,
      house: c.house || '', qty,
    });
  }
  return out;
}

// Has anything actually been typed over? Compares the grid to what's counted
// now, so re-saving an untouched sheet can be refused before it's sent.
export function sheetDirty(cells, rows, binId) {
  const have = byBin(rows).get(binId) || new Map();
  return sheetLines(cells, rows, binId).some(
    (l) => l.qty !== Math.max(0, have.get(key(l.item_type, l.size, l.house))?.qty || 0)
  );
}
