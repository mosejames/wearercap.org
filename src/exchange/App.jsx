import { useEffect, useMemo, useState } from 'react';
import {
  SITE, ITEM_TYPES, SIZES, ACCEPTING, NOT_ACCEPTING, APPROX_NOTE,
  FRONT_DESK_DAYS, houseById, houseInfo, HOUSE_CHOICES, HOUSED_TYPES,
  typeLabel, binUrl, CONTACT,
} from './config.js';
import * as db from './data.js';
import { byBin, totals, pickBin, drift } from './inventory.js';
import { qrSvg } from './qr.js';

// ---------------------------------------------------------------------------
// Routing — tiny hash router, same style as the rest of the site.
// ---------------------------------------------------------------------------
function parseHash() {
  const h = (window.location.hash || '').replace(/^#\/?/, '');
  const [head, ...rest] = h.split('/');
  if (head === 'bin' && rest[0]) return { view: 'bin', code: decodeURIComponent(rest[0]).toUpperCase() };
  if (head === 'requests') return { view: 'requests' };
  if (head === 'admin') return { view: 'admin' };
  return { view: 'home' };
}

const fmtDay = (iso) =>
  new Date(iso).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });

function dueInfo(iso) {
  if (!iso) return null;
  const ms = new Date(iso) - Date.now();
  const days = Math.ceil(ms / 86400000);
  if (ms < 0) return { label: `was due ${fmtDay(iso)}`, urgent: true, overdue: true };
  if (days <= 1) return { label: `due today–tomorrow (${fmtDay(iso)})`, urgent: true };
  return { label: `due ${fmtDay(iso)} · ${days} days`, urgent: false };
}

const STATUS_LABEL = {
  open: 'Waitlist', assigned: 'With a bin holder', fulfilled: 'At the front desk', canceled: 'Canceled',
};

// Uniforms are broken up by houses — every item wears its house's color.
function HouseTag({ id }) {
  const h = houseInfo(id);
  return (
    <span
      className={`house-chip ${id ? '' : 'any'}`}
      style={{ background: h.color, color: h.fg }}
    >{h.name}</span>
  );
}

const itemKey = (x) => `${x.itemType || x.item_type}|${x.size}|${x.house || ''}`;

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------
export default function App() {
  const [route, setRoute] = useState(parseHash());
  const [bins, setBins] = useState([]);
  const [inv, setInv] = useState([]);
  const [reqs, setReqs] = useState([]);
  const [offers, setOffers] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');

  const refresh = async () => {
    try {
      const [b, i, r, o] = await Promise.all([
        db.listBins(), db.listInventory(), db.listRequests(), db.listOffers(),
      ]);
      setBins(b); setInv(i); setReqs(r); setOffers(o); setErr('');
    } catch (e) {
      setErr(e.message || 'Could not reach the exchange.');
    } finally {
      setLoaded(true);
    }
  };

  useEffect(() => { refresh(); }, []);
  useEffect(() => {
    const onHash = () => setRoute(parseHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const binByCode = useMemo(() => {
    const m = new Map();
    bins.forEach((b) => m.set(b.code, b));
    return m;
  }, [bins]);

  return (
    <>
      <header className="topbar">
        <div className="shell topbar-in">
          <a className="mark" href="#/">
            RCAP <span>UNIFORM EXCHANGE</span>
            <small>{SITE.meta.join(' · ')}</small>
          </a>
          <nav className="topnav">
            <a href="#/">Browse</a>
            <a href="#/requests">Requests</a>
          </nav>
        </div>
      </header>

      {err && <div className="shell warn">⚠ {err}</div>}

      {!loaded ? (
        <div className="shell loading">Opening the bins…</div>
      ) : route.view === 'bin' ? (
        <BinView bin={binByCode.get(route.code)} code={route.code} bins={bins} inv={inv} reqs={reqs} offers={offers} refresh={refresh} />
      ) : route.view === 'requests' ? (
        <RequestsView bins={bins} reqs={reqs} refresh={refresh} />
      ) : route.view === 'admin' ? (
        <AdminView bins={bins} inv={inv} reqs={reqs} offers={offers} refresh={refresh} />
      ) : (
        <Home bins={bins} inv={inv} reqs={reqs} refresh={refresh} />
      )}

      <footer className="foot">
        <div className="shell">
          <p>
            Questions, donations, or a bin of your own? Uniform Swap chair{' '}
            <b>{CONTACT.name}</b> · <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          </p>
          <p className="foot-fine">Parent-run, alongside RCA. · <a href="#/admin">Back office</a></p>
        </div>
      </footer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Home — search everything, request an item.
// ---------------------------------------------------------------------------
function Home({ bins, inv, reqs, refresh }) {
  const [type, setType] = useState('');
  const [size, setSize] = useState('');
  const [house, setHouse] = useState('all'); // 'all' | '' (any-house) | house id
  const [sheet, setSheet] = useState(null); // { itemType, size, house } or 'waitlist'
  const [offering, setOffering] = useState(false);

  const assigned = reqs.filter((r) => r.status === 'assigned');
  const all = useMemo(() => totals(inv), [inv]);
  const shown = all.filter(
    (t) =>
      (!type || t.itemType === type) &&
      (!size || t.size === size) &&
      // A house pick also shows house-neutral items — they fit everyone.
      (house === 'all' || t.house === house || (house !== '' && t.house === ''))
  );
  const activeBins = bins.filter((b) => !b.retired);

  return (
    <>
      <section className="hero">
        <div className="shell">
          <p className="kicker">{SITE.kicker}</p>
          <h1>
            {SITE.titleLead} <span className="flame">{SITE.titleGrad}</span>
          </h1>
          <p className="intro">{SITE.intro}</p>
          <div className="hero-cta">
            <a className="btn on-night" href="#find" onClick={(e) => {
              e.preventDefault();
              document.getElementById('find')?.scrollIntoView({ behavior: 'smooth' });
            }}>🔎 I'm looking for an item</a>
            <button className="btn ghost-night" onClick={() => setOffering(true)}>
              👕 I have clothes to donate
            </button>
          </div>
        </div>
      </section>

      <section className="shell section" id="find">
        <h2 className="h2">Find a size</h2>
        <p className="sub">{APPROX_NOTE}</p>
        <div className="filters">
          <select value={house} onChange={(e) => setHouse(e.target.value)}>
            <option value="all">Every house</option>
            {HOUSE_CHOICES.map((h) => (
              <option key={h.id || 'any'} value={h.id}>{h.id ? h.name : 'Any house (neutral items)'}</option>
            ))}
          </select>
          <select value={type} onChange={(e) => setType(e.target.value)}>
            <option value="">Every item</option>
            {ITEM_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <select value={size} onChange={(e) => setSize(e.target.value)}>
            <option value="">Every size</option>
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>

        {shown.length === 0 ? (
          <div className="empty">
            <p>Nothing in the bins for that just now.</p>
            <button className="btn flame" onClick={() => setSheet('waitlist')}>
              Join the waitlist — we'll match the next one in
            </button>
          </div>
        ) : (
          <ul className="stock">
            {shown.map((t) => (
              <li key={itemKey(t)} className="stock-row">
                <div className="stock-what">
                  <b>{typeLabel(t.itemType)}</b>
                  <HouseTag id={t.house} />
                  <span className="size-chip">{t.size}</span>
                </div>
                <div className="stock-meta">
                  <span>~{t.qty} across {t.bins.length} bin{t.bins.length > 1 ? 's' : ''}</span>
                  <button className="btn small" onClick={() => setSheet({ itemType: t.itemType, size: t.size, house: t.house })}>
                    Request
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="shell section cols">
        <div className="card">
          <h3>Bins are accepting</h3>
          <ul className="ticks">{ACCEPTING.map((a) => <li key={a}>💚 {a}</li>)}</ul>
        </div>
        <div className="card">
          <h3>Please don't donate</h3>
          <ul className="ticks">{NOT_ACCEPTING.map((a) => <li key={a}>🚫 {a}</li>)}</ul>
          <p className="fine">Retired styles — please pass these to another school of your choice.</p>
        </div>
      </section>

      {sheet && (
        <RequestSheet
          preset={sheet === 'waitlist' ? { itemType: type, size, house: house === 'all' ? '' : house } : sheet}
          inv={inv}
          assigned={assigned}
          bins={bins}
          onDone={() => { setSheet(null); refresh(); }}
          onClose={() => setSheet(null)}
        />
      )}
      {offering && (
        <OfferSheet
          bins={bins}
          onDone={() => { setOffering(false); refresh(); }}
          onClose={() => setOffering(false)}
        />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// The request sheet — name + student, then the app matches a bin and starts
// the three-day clock.
// ---------------------------------------------------------------------------
function RequestSheet({ preset, inv, assigned, bins, onDone, onClose }) {
  const [form, setForm] = useState({
    parentName: '', student: '', contact: '', note: '',
    itemType: preset.itemType || ITEM_TYPES[0].id,
    size: preset.size || SIZES[0],
    house: preset.house || '',
    requesterHouse: preset.house || '',
    qty: 1,
  });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');

  const set = (k) => (e) => setForm({ ...form, [k]: e.target ? e.target.value : e });

  const submit = async () => {
    if (!form.parentName.trim()) { setErr('Your name is the one thing we need.'); return; }
    setBusy(true); setErr('');
    try {
      // Relationships first: route to the requester's own house bin when it
      // has the item, even for house-neutral pieces like khakis.
      const houseBins = bins
        .filter((b) => !b.retired && b.holder_house === form.requesterHouse)
        .map((b) => b.id);
      const binId = pickBin(
        inv, assigned, form.itemType, form.size, form.house,
        Number(form.qty) || 1, houseBins
      );
      const row = await db.addRequest({ ...form, qty: Number(form.qty) || 1 }, binId);
      setResult(row);
    } catch (e) {
      setErr(e.message || "That didn't go through — try again.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const bin = bins.find((b) => b.id === result.bin_id);
    return (
      <Sheet onClose={onDone} title="Request in!">
        {result.status === 'assigned' ? (
          <>
            <p className="big">
              <b>{typeLabel(result.item_type)}{result.house ? ` (${houseInfo(result.house).name})` : ''} · {result.size}</b> is with the{' '}
            <b>{bin ? bin.name : 'bin'}</b>{bin?.holder_name ? ` (${bin.holder_name})` : ''}.
            </p>
            <p>
              It'll be at the <b>RCA front desk by {fmtDay(result.due_at)}</b> with your name on it.
              Check <a href="#/requests">Requests</a> any time for status.
            </p>
          </>
        ) : (
          <p className="big">
            Nothing in the bins right now, so you're on the <b>waitlist</b> — the moment a match
            is added to any bin, RCAP will assign it and it lands at the front desk within{' '}
            {FRONT_DESK_DAYS} days.
          </p>
        )}
        <button className="btn flame wide" onClick={onDone}>Done</button>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} title="Request an item">
      <div className="grid2">
        <label>Item
          <select value={form.itemType} onChange={set('itemType')}>
            {ITEM_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label>Size
          <select value={form.size} onChange={set('size')}>
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </div>
      <div className="grid2">
        <label>Item's house
          <select value={form.house} onChange={set('house')}>
            {HOUSE_CHOICES.map((h) => (
              <option key={h.id || 'any'} value={h.id}>{h.id ? h.name : 'Any house / no colors'}</option>
            ))}
          </select>
        </label>
        <label>Your house
          <select value={form.requesterHouse} onChange={set('requesterHouse')}>
            <option value="">—</option>
            {HOUSE_CHOICES.filter((h) => h.id).map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </label>
      </div>
      <p className="fine">We route requests through your own house's bin whenever it has the item — that's how the swap has always worked.</p>
      <div className="grid2">
        <label>Your name *
          <input value={form.parentName} onChange={set('parentName')} placeholder="Danielle" maxLength={60} />
        </label>
        <label>Student (optional)
          <input value={form.student} onChange={set('student')} placeholder="Imani" maxLength={60} />
        </label>
      </div>
      <label>Cell number (optional — we'll text you updates: request received, item at the front desk)
        <input value={form.contact} onChange={set('contact')} inputMode="tel" placeholder="404-555-1234" maxLength={80} />
      </label>
      <label>Anything else? (optional)
        <input value={form.note} onChange={set('note')} placeholder="Slim fit if there's a choice" maxLength={200} />
      </label>
      <label className="qty">How many?
        <select value={form.qty} onChange={set('qty')}>
          {[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </label>
      {err && <p className="err">{err}</p>}
      <button className="btn flame wide" disabled={busy} onClick={submit}>
        {busy ? 'Sending…' : 'Submit request'}
      </button>
      <p className="fine">
        A bin holder brings it to the RCA front desk within {FRONT_DESK_DAYS} days. Free, always.
      </p>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// The offer sheet — "I have clothes, come get them." Routed to the offerer's
// house bin; the holder reaches out to arrange the pickup.
// ---------------------------------------------------------------------------
function OfferSheet({ bins, onDone, onClose }) {
  const [form, setForm] = useState({ parentName: '', contact: '', house: '', itemsDesc: '' });
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });

  const submit = async () => {
    if (!form.parentName.trim()) { setErr('Your name is the one thing we need.'); return; }
    if (!form.itemsDesc.trim()) { setErr('Tell us roughly what you have.'); return; }
    setBusy(true); setErr('');
    try {
      const houseBin = bins.find((b) => !b.retired && b.holder_house === form.house)
        || bins.find((b) => !b.retired);
      const row = await db.addOffer(form, houseBin ? houseBin.id : null);
      setResult(row);
    } catch (e) {
      setErr(e.message || "That didn't go through — try again.");
    } finally {
      setBusy(false);
    }
  };

  if (result) {
    const bin = bins.find((b) => b.id === result.bin_id);
    return (
      <Sheet onClose={onDone} title="Thank you! 💚">
        <p className="big">
          Your offer is in{bin?.holder_name ? <> — <b>{bin.holder_name}</b> ({bin.name}) will reach
          out to arrange the pickup</> : ' — a bin holder will reach out to arrange the pickup'}.
        </p>
        {form.contact.trim() && <p>We just texted you a confirmation.</p>}
        <button className="btn flame wide" onClick={onDone}>Done</button>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} title="Donate clothes">
      <p className="fine">
        Gently loved only, please — and a heads-up on what bins can't take is below the search.
      </p>
      <div className="grid2">
        <label>Your name *
          <input value={form.parentName} onChange={set('parentName')} placeholder="Danielle" maxLength={60} />
        </label>
        <label>Your house
          <select value={form.house} onChange={set('house')}>
            <option value="">—</option>
            {HOUSE_CHOICES.filter((h) => h.id).map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </label>
      </div>
      <label>Cell number (so your bin holder can arrange the pickup)
        <input value={form.contact} onChange={set('contact')} inputMode="tel" placeholder="404-555-1234" maxLength={80} />
      </label>
      <label>What do you have? *
        <textarea
          rows={3} value={form.itemsDesc} onChange={set('itemsDesc')} maxLength={400}
          placeholder="Two YM Amistad polos, a stack of khakis size 10, one ski jacket…"
        />
      </label>
      {err && <p className="err">{err}</p>}
      <button className="btn flame wide" disabled={busy} onClick={submit}>
        {busy ? 'Sending…' : 'Offer it up'}
      </button>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Requests — everyone can see the queue; cancel is one tap.
// ---------------------------------------------------------------------------
function RequestsView({ bins, reqs, refresh }) {
  const [who, setWho] = useState('');
  const shown = reqs.filter(
    (r) => !who || r.parent_name.toLowerCase().includes(who.toLowerCase())
  );
  const binName = (id) => bins.find((b) => b.id === id)?.name || '—';

  return (
    <section className="shell section">
      <h2 className="h2">Requests</h2>
      <input
        className="search" placeholder="Find your name…"
        value={who} onChange={(e) => setWho(e.target.value)}
      />
      <ul className="req-list">
        {shown.length === 0 && <li className="empty">No requests yet.</li>}
        {shown.map((r) => {
          const due = r.status === 'assigned' ? dueInfo(r.due_at) : null;
          return (
            <li key={r.id} className={`req status-${r.status}`}>
              <div className="req-main">
                <b>{typeLabel(r.item_type)} · {r.size}{r.qty > 1 ? ` ×${r.qty}` : ''} <HouseTag id={r.house} /></b>
                <span>{r.parent_name}{r.student ? ` · for ${r.student}` : ''}</span>
              </div>
              <div className="req-side">
                <span className={`chip chip-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                {r.status === 'assigned' && (
                  <span className={`due ${due?.urgent ? 'urgent' : ''}`}>
                    {binName(r.bin_id)} · {due?.label}
                  </span>
                )}
                {(r.status === 'open' || r.status === 'assigned') && (
                  <button
                    className="linkish"
                    onClick={async () => { await db.cancelRequest(r.id); refresh(); }}
                  >cancel</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ---------------------------------------------------------------------------
// The bin page — what the QR code opens. Inventory, add/take flows, and the
// holder's fulfillment queue.
// ---------------------------------------------------------------------------
function BinView({ bin, code, bins, inv, reqs, offers, refresh }) {
  const [mode, setMode] = useState(null); // 'add' | 'take'
  const [log, setLog] = useState(null);

  useEffect(() => {
    if (bin) db.listMovements(bin.id).then(setLog).catch(() => setLog([]));
  }, [bin?.id]);

  if (!bin) {
    return (
      <section className="shell section">
        <h2 className="h2">Hmm — bin “{code}” isn't on file.</h2>
        <p>Check the code under the QR label, or head <a href="#/">back to the exchange</a>.</p>
      </section>
    );
  }

  const house = houseById(bin.holder_house);
  const mine = byBin(inv).get(bin.id) || new Map();
  const items = [...mine.values()].filter((i) => i.qty > 0)
    .sort((a, b) =>
      a.itemType.localeCompare(b.itemType) ||
      (a.house || '').localeCompare(b.house || '') ||
      a.size.localeCompare(b.size));
  const queue = reqs.filter((r) => r.bin_id === bin.id && r.status === 'assigned');
  const pickups = (offers || []).filter(
    (o) => o.bin_id === bin.id && (o.status === 'open' || o.status === 'scheduled')
  );

  return (
    <>
      <section className="hero bin-hero" style={house ? { borderTop: `6px solid ${house.color}` } : null}>
        <div className="shell">
          <p className="kicker">Bin {bin.code}{house ? ` · ${house.name}` : ''}</p>
          <h1>{bin.name}</h1>
          {bin.holder_name && <p className="intro">In the care of <b>{bin.holder_name}</b>. {bin.holder_note}</p>}
          <div className="hero-cta">
            <button className="btn on-night" onClick={() => setMode('add')}>＋ I'm adding items</button>
            <button className="btn ghost-night" onClick={() => setMode('take')}>− Taking items out</button>
          </div>
        </div>
      </section>

      {queue.length > 0 && (
        <section className="shell section">
          <h2 className="h2 flame-text">To the front desk 🏫</h2>
          <p className="sub">
            These requests are assigned to this bin. Drop each at the RCA front desk,
            labeled with the parent's name, then tap <b>Delivered</b>.
          </p>
          <ul className="req-list">
            {queue.map((r) => {
              const due = dueInfo(r.due_at);
              return (
                <li key={r.id} className={`req holder ${due?.overdue ? 'overdue' : ''}`}>
                  <div className="req-main">
                    <b>{typeLabel(r.item_type)} · {r.size}{r.qty > 1 ? ` ×${r.qty}` : ''} <HouseTag id={r.house} /></b>
                    <span>for {r.parent_name}{r.student ? ` (${r.student})` : ''}{r.note ? ` — “${r.note}”` : ''}</span>
                  </div>
                  <div className="req-side">
                    <span className={`due ${due?.urgent ? 'urgent' : ''}`}>{due?.label}</span>
                    <button
                      className="btn small flame"
                      onClick={async () => { await db.fulfillRequest(r.id, bin.holder_name); refresh(); }}
                    >Delivered ✓</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {pickups.length > 0 && (
        <section className="shell section">
          <h2 className="h2">Pickups to arrange 👕</h2>
          <p className="sub">Parents offering clothes for this bin. Reach out, grab the bag, then log what came in with “I'm adding items.”</p>
          <ul className="req-list">
            {pickups.map((o) => (
              <li key={o.id} className="req holder">
                <div className="req-main">
                  <b>{o.parent_name}{o.contact ? ` · ${o.contact}` : ''}</b>
                  <span>{o.items_desc}</span>
                </div>
                <div className="req-side">
                  {o.status === 'open' ? (
                    <button className="btn small" onClick={async () => { await db.updateOffer(o.id, 'scheduled'); refresh(); }}>
                      Pickup arranged
                    </button>
                  ) : (
                    <span className="chip chip-assigned">Scheduled</span>
                  )}
                  <button className="btn small flame" onClick={async () => { await db.updateOffer(o.id, 'collected'); refresh(); }}>
                    Collected ✓
                  </button>
                  <button className="linkish" onClick={async () => { await db.updateOffer(o.id, 'canceled'); refresh(); }}>
                    cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="shell section">
        <h2 className="h2">What's in this bin</h2>
        <p className="sub">{APPROX_NOTE}</p>
        {items.length === 0 ? (
          <p className="empty">Empty (or nobody's counted yet). Tap “I'm adding items” after you drop things in.</p>
        ) : (
          <ul className="stock">
            {items.map((i) => (
              <li key={itemKey(i)} className="stock-row">
                <div className="stock-what">
                  <b>{typeLabel(i.itemType)}</b>
                  <HouseTag id={i.house} />
                  <span className="size-chip">{i.size}</span>
                </div>
                <div className="stock-meta"><span>~{i.qty}</span></div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {log && log.length > 0 && (
        <section className="shell section">
          <h2 className="h2">Recent activity</h2>
          <ul className="activity">
            {log.map((m) => (
              <li key={m.id}>
                <span className={`delta ${m.qty_delta > 0 ? 'pos' : 'neg'}`}>
                  {m.qty_delta > 0 ? `+${m.qty_delta}` : m.qty_delta}
                </span>
                {typeLabel(m.item_type)}{m.house ? ` (${houseInfo(m.house).name})` : ''} · {m.size}
                {m.actor_name ? ` — ${m.actor_name}` : ''}
                <time>{fmtDay(m.created_at)}</time>
              </li>
            ))}
          </ul>
        </section>
      )}

      {mode && (
        <MoveSheet
          bin={bin} sign={mode === 'add' ? 1 : -1}
          onDone={() => { setMode(null); refresh(); db.listMovements(bin.id).then(setLog); }}
          onClose={() => setMode(null)}
        />
      )}
    </>
  );
}

// Add / take items — a running list so a whole grocery bag logs in one go.
function MoveSheet({ bin, sign, onDone, onClose }) {
  const [lines, setLines] = useState([]);
  const [cur, setCur] = useState({
    itemType: ITEM_TYPES[0].id, size: SIZES[1], qty: 1,
    // House bins mostly hold their own house's gear — start there.
    house: HOUSED_TYPES.includes(ITEM_TYPES[0].id) ? (bin.holder_house || '') : '',
  });
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const addLine = () => {
    setLines([...lines, { ...cur, qty: Number(cur.qty) || 1 }]);
  };

  const submit = async () => {
    const all = lines.length ? lines : [{ ...cur, qty: Number(cur.qty) || 1 }];
    setBusy(true); setErr('');
    try {
      await db.logMovements(bin.id, all, sign, name);
      onDone();
    } catch (e) {
      setErr(e.message || "That didn't go through — try again.");
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={onClose} title={sign > 0 ? `Adding to ${bin.code}` : `Taking out of ${bin.code}`}>
      <p className="fine">
        {sign > 0
          ? 'Roughly what went in? Close counts are perfect counts here.'
          : 'Roughly what came out? (Requests you deliver log themselves — this is for everything else.)'}
      </p>
      <div className="grid2">
        <label>Item
          <select
            value={cur.itemType}
            onChange={(e) => {
              const itemType = e.target.value;
              setCur({
                ...cur, itemType,
                house: HOUSED_TYPES.includes(itemType) ? (cur.house || bin.holder_house || '') : '',
              });
            }}>
            {ITEM_TYPES.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label>House
          <select value={cur.house} onChange={(e) => setCur({ ...cur, house: e.target.value })}>
            {HOUSE_CHOICES.map((h) => (
              <option key={h.id || 'any'} value={h.id}>{h.id ? h.name : 'Any house / no house colors'}</option>
            ))}
          </select>
        </label>
      </div>
      <div className="grid2">
        <label>Size
          <select value={cur.size} onChange={(e) => setCur({ ...cur, size: e.target.value })}>
            {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
        <label>Qty
          <select value={cur.qty} onChange={(e) => setCur({ ...cur, qty: e.target.value })}>
            {Array.from({ length: 20 }, (_, i) => i + 1).map((n) => <option key={n} value={n}>{n}</option>)}
          </select>
        </label>
      </div>
      <button className="btn ghost wide" onClick={addLine}>＋ Another line</button>
      {lines.length > 0 && (
        <ul className="lines">
          {lines.map((l, i) => (
            <li key={i}>
              {sign > 0 ? '+' : '−'}{l.qty} {typeLabel(l.itemType)}{l.house ? ` (${houseInfo(l.house).name})` : ''} · {l.size}
              <button className="linkish" onClick={() => setLines(lines.filter((_, j) => j !== i))}>remove</button>
            </li>
          ))}
        </ul>
      )}
      <label>Your name (optional, for the log)
        <input value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      </label>
      {err && <p className="err">{err}</p>}
      <button className="btn flame wide" disabled={busy} onClick={submit}>
        {busy ? 'Logging…' : sign > 0 ? 'Log it in' : 'Log it out'}
      </button>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// Back office — passcode-gated in the database, like the Recap.
// ---------------------------------------------------------------------------
function AdminView({ bins, inv, reqs, offers, refresh }) {
  const [pass, setPass] = useState(sessionStorage.getItem('ue-pass') || '');
  const [ok, setOk] = useState(!!sessionStorage.getItem('ue-pass'));
  const [form, setForm] = useState({ code: '', name: '', holderName: '', holderHouse: '' });
  const [msg, setMsg] = useState('');
  const [printMode, setPrintMode] = useState(false);

  const tryPass = async () => {
    try {
      // Any admin call verifies the passcode server-side; a no-op update works.
      await db.adminBin(pass, 'update', bins[0]?.id, {});
      sessionStorage.setItem('ue-pass', pass);
      setOk(true); setMsg('');
    } catch {
      setMsg("That passcode isn't it.");
    }
  };

  if (!ok) {
    return (
      <section className="shell section narrow-card">
        <h2 className="h2">Back office</h2>
        <input className="search" type="password" placeholder="Passcode" value={pass}
          onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && tryPass()} />
        {msg && <p className="err">{msg}</p>}
        <button className="btn flame" onClick={tryPass}>Open</button>
      </section>
    );
  }

  const waitlist = reqs.filter((r) => r.status === 'open');
  const assigned = reqs.filter((r) => r.status === 'assigned');
  const overdue = assigned.filter((r) => dueInfo(r.due_at)?.overdue);
  const driftRows = drift(inv);
  const act = async (fn) => {
    try { await fn(); setMsg(''); refresh(); }
    catch (e) { setMsg(e.message || 'Nope.'); }
  };

  if (printMode) {
    return (
      <section className="print-sheet">
        <button className="btn no-print" onClick={() => setPrintMode(false)}>← Back</button>
        <button className="btn flame no-print" onClick={() => window.print()}>Print</button>
        <div className="labels">
          {bins.filter((b) => !b.retired).map((b) => (
            <div className="label" key={b.id}>
              <div dangerouslySetInnerHTML={{ __html: qrSvg(binUrl(b.code), 240) }} />
              <b>{b.name}</b>
              <span>Scan to see inside · add what you drop in</span>
              <code>{b.code} · wearercap.org/uniform-exchange</code>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section className="shell section">
      <h2 className="h2">Back office</h2>
      {msg && <p className="err">{msg}</p>}
      <div className="admin-actions">
        <button className="btn" onClick={() => setPrintMode(true)}>🖨 Print QR bin labels</button>
      </div>

      {overdue.length > 0 && (
        <div className="card overdue-card">
          <h3>⏰ Past the three days</h3>
          <ul>
            {overdue.map((r) => (
              <li key={r.id}>
                <b>{typeLabel(r.item_type)}{r.house ? ` (${houseInfo(r.house).name})` : ''} · {r.size}</b> for {r.parent_name}
                {r.contact ? ` (${r.contact})` : ''} — {bins.find((b) => b.id === r.bin_id)?.holder_name || 'bin'}
                , {dueInfo(r.due_at).label}
              </li>
            ))}
          </ul>
          <p className="fine">A gentle nudge in the House group chat usually does it.</p>
        </div>
      )}

      {waitlist.length > 0 && (
        <div className="card">
          <h3>Waitlist — assign when stock lands</h3>
          <ul className="req-list">
            {waitlist.map((r) => (
              <li key={r.id} className="req">
                <div className="req-main">
                  <b>{typeLabel(r.item_type)} · {r.size}{r.qty > 1 ? ` ×${r.qty}` : ''} <HouseTag id={r.house} /></b>
                  <span>{r.parent_name}{r.contact ? ` · ${r.contact}` : ''}</span>
                </div>
                <div className="req-side">
                  <select defaultValue="" onChange={(e) => e.target.value &&
                    act(() => db.assignRequest(r.id, e.target.value))}>
                    <option value="" disabled>Assign to bin…</option>
                    {bins.filter((b) => !b.retired).map((b) =>
                      <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className="card">
        <h3>Bins</h3>
        <ul className="bin-admin">
          {bins.map((b) => (
            <li key={b.id} className={b.retired ? 'retired' : ''}>
              <a href={`#/bin/${b.code}`}><b>{b.code}</b> {b.name}</a>
              <span>{b.holder_name || 'no holder yet'}</span>
              <button className="linkish" onClick={() => {
                const holderName = prompt('Holder name', b.holder_name);
                if (holderName !== null) act(() => db.adminBin(pass, 'update', b.id, { holderName }));
              }}>edit holder</button>
              <button className="linkish" onClick={() =>
                act(() => db.adminBin(pass, b.retired ? 'restore' : 'retire', b.id))}>
                {b.retired ? 'restore' : 'retire'}
              </button>
            </li>
          ))}
        </ul>
        <h3>New bin</h3>
        <div className="grid3">
          <label>Code <input value={form.code} placeholder="AMI-2"
            onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} /></label>
          <label>Name <input value={form.name} placeholder="Amistad Bin 2"
            onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
          <label>Holder <input value={form.holderName}
            onChange={(e) => setForm({ ...form, holderName: e.target.value })} /></label>
        </div>
        <label>House
          <select value={form.holderHouse} onChange={(e) => setForm({ ...form, holderHouse: e.target.value })}>
            <option value="">None / mixed</option>
            {['altruismo', 'amistad', 'isibindi', 'reveur'].map((h) => <option key={h} value={h}>{h}</option>)}
          </select>
        </label>
        <button className="btn" onClick={() =>
          act(async () => {
            await db.adminBin(pass, 'create', null, form);
            setForm({ code: '', name: '', holderName: '', holderHouse: '' });
          })}>Create bin</button>
      </div>

      <AdminOffers bins={bins} offers={offers} refresh={refresh} />
      <AdminReports bins={bins} inv={inv} reqs={reqs} />
      <AdminNotifications />

      {driftRows.length > 0 && (
        <div className="card">
          <h3>Count drift (bins that went below zero)</h3>
          <ul>
            {driftRows.map((d, i) => (
              <li key={i}>
                {bins.find((b) => b.id === d.bin_id)?.name || d.bin_id}: {typeLabel(d.item_type)}{d.house ? ` (${houseInfo(d.house).name})` : ''} · {d.size} at {d.qty}
              </li>
            ))}
          </ul>
          <p className="fine">Harmless — it means takes were logged that adds never were. It self-corrects at the next add.</p>
        </div>
      )}
    </section>
  );
}

// Donation offers, all houses — the admin's view of pickups in flight.
function AdminOffers({ bins, offers, refresh }) {
  const live = (offers || []).filter((o) => o.status === 'open' || o.status === 'scheduled');
  if (!live.length) return null;
  const binName = (id) => bins.find((b) => b.id === id)?.name || 'unassigned';
  return (
    <div className="card">
      <h3>Donation pickups in flight</h3>
      <ul className="req-list">
        {live.map((o) => (
          <li key={o.id} className="req">
            <div className="req-main">
              <b>{o.parent_name} <HouseTag id={o.house} /></b>
              <span>{o.items_desc}</span>
              <span>{o.contact || 'no contact left'} · {binName(o.bin_id)} · {fmtDay(o.created_at)}</span>
            </div>
            <div className="req-side">
              <span className={`chip ${o.status === 'open' ? 'chip-open' : 'chip-assigned'}`}>
                {o.status === 'open' ? 'Needs contact' : 'Scheduled'}
              </span>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

// The numbers Mose wants OFF the front page and IN the back office:
// circulation, movement, and how the houses are doing. History, not hype.
function AdminReports({ bins, inv, reqs }) {
  const all = totals(inv);
  const onHand = all.reduce((n, t) => n + t.qty, 0);
  const fulfilled = reqs.filter((r) => r.status === 'fulfilled');
  const waitlist = reqs.filter((r) => r.status === 'open');

  // Per-house: items on hand (by the item's house) and requests routed there.
  const houses = ['altruismo', 'amistad', 'isibindi', 'reveur', ''];
  const rows = houses.map((h) => ({
    house: h,
    onHand: all.filter((t) => t.house === h).reduce((n, t) => n + t.qty, 0),
    requested: reqs.filter((r) => (r.house || '') === h && r.status !== 'canceled').length,
    rehomed: fulfilled.filter((r) => (r.house || '') === h).length,
  })).filter((r) => r.onHand || r.requested || r.rehomed);

  // Average days from request to front desk.
  const days = fulfilled
    .filter((r) => r.fulfilled_at && r.created_at)
    .map((r) => (new Date(r.fulfilled_at) - new Date(r.created_at)) / 86400000);
  const avgDays = days.length ? (days.reduce((a, b) => a + b, 0) / days.length).toFixed(1) : null;

  return (
    <div className="card">
      <h3>Reports</h3>
      <div className="report-stats">
        <div><b>{onHand}</b><span>items on hand</span></div>
        <div><b>{fulfilled.length}</b><span>uniforms rehomed</span></div>
        <div><b>{waitlist.length}</b><span>on the waitlist</span></div>
        {avgDays && <div><b>{avgDays}d</b><span>avg to front desk</span></div>}
      </div>
      {rows.length > 0 && (
        <table className="report-table">
          <thead>
            <tr><th>Items by house</th><th>On hand</th><th>Requested</th><th>Rehomed</th></tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.house || 'any'}>
                <td><HouseTag id={r.house} /></td>
                <td>~{r.onHand}</td><td>{r.requested}</td><td>{r.rehomed}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <p className="fine">Every add, take, and delivery is in the movement log — open any bin for its history.</p>
    </div>
  );
}

// The text-message outbox: what's queued, what's gone out.
function AdminNotifications() {
  const [rows, setRows] = useState(null);
  useEffect(() => { db.listNotifications().then(setRows).catch(() => setRows([])); }, []);
  if (!rows || !rows.length) return null;
  const pending = rows.filter((n) => n.status === 'pending').length;
  return (
    <div className="card">
      <h3>Text updates {pending > 0 ? `· ${pending} queued` : ''}</h3>
      <p className="fine">
        Queued texts go out about once an hour (request received, item at the front desk,
        donation offer confirmed).
      </p>
      <ul className="activity">
        {rows.slice(0, 12).map((n) => (
          <li key={n.id}>
            <span className={`chip ${n.status === 'sent' ? 'chip-fulfilled' : n.status === 'pending' ? 'chip-open' : 'chip-canceled'}`}>{n.status}</span>
            <span className="notif-body">{n.body.slice(0, 80)}…</span>
            <time>{fmtDay(n.created_at)}</time>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Shared bottom sheet.
// ---------------------------------------------------------------------------
function Sheet({ title, children, onClose }) {
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = ''; };
  }, []);
  return (
    <div className="sheet-wrap" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="sheet">
        <div className="sheet-head">
          <h3>{title}</h3>
          <button className="x" onClick={onClose} aria-label="Close">✕</button>
        </div>
        {children}
      </div>
    </div>
  );
}
