// ---------------------------------------------------------------------------
// Proof that the thing is alive.
//
// A swap dies quietly. The bins are full, the site looks like a form, and every
// family who lands on it assumes nothing is in there and nobody else is using
// it. So the front page says what's actually been happening — someone dropped
// six polos in on Tuesday, an Amistad family took khakis home this morning,
// there are forty polos sitting in a tub right now waiting for somebody.
//
// Everything here is anonymous by construction. A house, an item, a count, a
// rough when. Never a family, never a holder, never a bin code — a bin narrows
// to one person, and "Shekita just handed off a polo" is nobody's business.
//
// Pure functions: movements and inventory in, sentences out.
// ---------------------------------------------------------------------------
import { typeLabel, houseInfo } from './config.js';

const DAY = 86400000;

// "just now" / "this morning" / "on Tuesday" / "last week" — vague on purpose.
// The exact minute somebody dropped off clothes isn't anyone's business either.
export function roughly(when, now = new Date()) {
  const ms = now - new Date(when);
  if (ms < 0) return 'just now';
  if (ms < 2 * 3600000) return 'just now';
  if (ms < DAY && now.getDate() === new Date(when).getDate()) return 'today';
  if (ms < 2 * DAY) return 'yesterday';
  if (ms < 7 * DAY) {
    return `on ${new Date(when).toLocaleDateString('en-US', { weekday: 'long' })}`;
  }
  if (ms < 21 * DAY) return 'last week';
  return '';
}

// "House Polo · Co-Ed" is a picking label, not a sentence. For prose, drop the
// qualifier after the middle dot and don't put an s on a word that already has
// one: "6 house polos", "khaki pants", never "khaki pantss".
const shortItem = (typeId) => typeLabel(typeId).split(' \u00b7 ')[0].toLowerCase();

function countOf(n, label) {
  const alreadyPlural = /s$/.test(label);
  if (n === 1) return alreadyPlural ? label : `1 ${label}`;
  return `${n} ${label}${alreadyPlural ? '' : 's'}`;
}

// A house name inside a sentence: 'amistad' → 'an Amistad', '' → 'a', because
// house-neutral kit belongs to everybody and naming a house would be a lie.
function houseWord(id) {
  if (!id) return 'a';
  const name = houseInfo(id).name;
  return `${/^[aeiou]/i.test(name) ? 'an' : 'a'} ${name}`;
}

const cap = (t) => t.charAt(0).toUpperCase() + t.slice(1);

// ---------------------------------------------------------------------------
// What just happened, from the movement log.
// ---------------------------------------------------------------------------
export function recentActivity(movements, bins = [], now = new Date()) {
  const out = [];

  for (const m of movements || []) {
    const age = now - new Date(m.created_at);
    if (age > 21 * DAY) continue;
    const when = roughly(m.created_at, now);
    if (!when) continue;

    // A neutral item stays neutral: the tub belongs to a house, the white
    // shirt inside it does not.
    const item = shortItem(m.item_type);
    const h = m.house || '';
    const n = Math.abs(m.qty_delta);

    if (m.kind === 'add' && m.qty_delta > 0) {
      out.push({
        key: `a-${m.id}`,
        text: `Someone dropped off ${countOf(n, item)} ${when}.`,
        house: h,
        at: m.created_at,
      });
    } else if (m.kind === 'fulfill' && m.qty_delta < 0) {
      out.push({
        key: `f-${m.id}`,
        text: `${cap(houseWord(h))} family took ${countOf(n, item)} home ${when}.`,
        house: h,
        at: m.created_at,
      });
    }
  }

  return out.sort((a, b) => new Date(b.at) - new Date(a.at));
}

// ---------------------------------------------------------------------------
// What's sitting there right now. The quiet kind of proof: not that something
// happened, but that something is waiting.
// ---------------------------------------------------------------------------
export function whatsWaiting(inventory, bins = []) {
  const agg = new Map();

  for (const row of inventory || []) {
    const qty = Math.max(0, row.qty);
    if (!qty) continue;
    const h = row.house || '';
    const key = `${h}|${row.item_type}`;
    agg.set(key, (agg.get(key) || 0) + qty);
  }

  return [...agg.entries()]
    .map(([key, qty]) => {
      const [h, itemType] = key.split('|');
      const item = shortItem(itemType);
      return {
        key: `w-${key}`,
        qty,
        house: h,
        text: h
          ? `${houseInfo(h).name} is sitting on ${countOf(qty, item)}, waiting for a new home.`
          : `There are ${countOf(qty, item)} in the bins right now, waiting for a new home.`,
      };
    })
    .filter((x) => x.qty >= 2)          // one of a thing isn't a headline
    .sort((a, b) => b.qty - a.qty);
}

// ---------------------------------------------------------------------------
// The mix that actually shows. Something that happened, then something that's
// waiting, alternating — so it reads as a place with a pulse rather than a
// stock report or a news ticker.
// ---------------------------------------------------------------------------
export function socialProof(movements, inventory, bins = [], now = new Date(), max = 8) {
  const did = recentActivity(movements, bins, now);
  const has = whatsWaiting(inventory, bins);
  const out = [];

  for (let i = 0; out.length < max && (i < did.length || i < has.length); i++) {
    if (did[i]) out.push(did[i]);
    if (has[i] && out.length < max) out.push(has[i]);
  }
  return out;
}


// ---------------------------------------------------------------------------
// Something to paste.
//
// The failure mode for a swap isn't that nobody wants the clothes — it's that
// a tub gets handed to a willing parent, goes in a closet, and is never
// mentioned again. So a holder gets a post written for them, out of what's
// actually in their bins today, ready for the house GroupMe.
//
// Written in their voice, not ours. Nobody forwards a press release.
// ---------------------------------------------------------------------------
export function suggestedPost(holder, inventory, url = 'wearercap.org/uniform-exchange') {
  const mine = (inventory || []).filter((r) => r.qty > 0);
  if (!mine.length) return '';

  const byType = new Map();
  for (const r of mine) {
    const cur = byType.get(r.item_type) || { qty: 0, sizes: new Set() };
    cur.qty += r.qty;
    cur.sizes.add(r.size);
    byType.set(r.item_type, cur);
  }

  const top = [...byType.entries()]
    .sort((a, b) => b[1].qty - a[1].qty)
    .slice(0, 3)
    .map(([id, v]) => {
      const sizes = [...v.sizes].slice(0, 4).join(', ');
      return `${countOf(v.qty, shortItem(id))}${sizes ? ` (${sizes})` : ''}`;
    });

  const list = top.length === 1
    ? top[0]
    : `${top.slice(0, -1).join(', ')} and ${top[top.length - 1]}`;

  const house = holder?.house ? `${houseInfo(holder.house).name} ` : '';
  const first = (holder?.name || '').split(' ')[0];

  return (
    `Hi ${house}families! I'm holding the RCAP uniform bin${first ? ` — ${first} here` : ''}. `
    + `Right now I've got ${list} sitting in my trunk, all gently loved and free. `
    + `If your student needs anything, ask for it here and I'll bring it to morning `
    + `carline: ${url}\n\n`
    + `And if you've got uniforms your kid has outgrown, I'll come pick them up.`
  );
}
