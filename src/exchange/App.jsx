import { useEffect, useMemo, useState } from 'react';
import {
  SITE, DONATION_STANDARD, APPROX_NOTE, FIT_HINT, sizeGroups, sizeLabel, firstSize,
  SIZE_SET_LABEL, prettyPhone, sizeChip,
  houseById, houseInfo, HOUSE_CHOICES, HOUSES,
  setItemTypes, allItemTypes, visibleItemTypes, typeHoused,
  typeLabel, binUrl, holderUrl, CONTACT,
} from './config.js';
import * as db from './data.js';
import { byBin, totals, pickBin, drift, stockByHouse } from './inventory.js';
import { nextSlots, slotLabel, handoffSummary, availabilityLine, myRequestsLead, WEEKDAYS } from './handoff.js';
import { qrSvg } from './qr.js';

// ---------------------------------------------------------------------------
// Routing — tiny hash router, same style as the rest of the site.
// ---------------------------------------------------------------------------
function parseHash() {
  // Shared links come in on short real paths (/uniform-exchange/h/<token>) so
  // that a scraper can be handed tags for that page rather than the front
  // door. Those normally bounce here as a hash, but read the path too — then
  // it works even if the rewrite is missing, as it is in local dev.
  const hash = window.location.hash || '';
  if (!hash) {
    const m = (window.location.pathname || '').match(/\/uniform-exchange\/([hbm])\/([^/]+)/);
    if (m) {
      const [, kind, raw] = m;
      if (kind === 'b') return { view: 'bin', code: decodeURIComponent(raw).toUpperCase() };
      return { view: kind === 'h' ? 'holder' : 'my', token: raw };
    }
    if (/\/uniform-exchange\/storage\/?$/.test(window.location.pathname || '')) {
      return { view: 'admin', sub: '' };
    }
  }

  const h = hash.replace(/^#\/?/, '');
  const [head, ...rest] = h.split('/');
  if (head === 'bin' && rest[0]) return { view: 'bin', code: decodeURIComponent(rest[0]).toUpperCase() };
  if (head === 'requests') return { view: 'requests' };
  if (head === 'my' && rest[0]) return { view: 'my', token: rest[0] };
  if (head === 'holder' && rest[0]) return { view: 'holder', token: rest[0] };
  if (head === 'admin') return { view: 'admin', sub: rest[0] || '' };
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
  open: 'Waitlist',
  assigned: 'Pick a handoff time',
  scheduled: 'Handoff set',
  handed_off: 'On its way',
  fulfilled: 'Received',
  canceled: 'Canceled',
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

// The size list follows the item: girls' bottoms, boys' bottoms, or tops.
function SizePicker({ itemType, value, onChange, placeholder }) {
  return (
    <select value={value} onChange={onChange}>
      {placeholder && <option value="">{placeholder}</option>}
      {sizeGroups(itemType).map((g, i) =>
        g.group ? (
          <optgroup key={g.group} label={g.group}>
            {g.sizes.map((s) => <option key={s.v} value={s.v}>{s.label}</option>)}
          </optgroup>
        ) : (
          g.sizes.map((s) => <option key={s.v + i} value={s.v}>{s.label}</option>)
        )
      )}
    </select>
  );
}

// ---------------------------------------------------------------------------
// App shell
// ---------------------------------------------------------------------------
export default function App() {
  const [route, setRoute] = useState(parseHash());
  const [bins, setBins] = useState([]);
  const [inv, setInv] = useState([]);
  const [commitments, setCommitments] = useState([]);
  const [holders, setHolders] = useState([]);
  const [, setTypes] = useState([]); // re-render when the live types land
  const [settings, setSettings] = useState({});
  const [loaded, setLoaded] = useState(false);
  const [err, setErr] = useState('');

  const refresh = async () => {
    try {
      const hs = await db.listHolders().catch(() => []);
      const [b, i, c, t, st] = await Promise.all([
        db.listBins(hs), db.listInventory(), db.listCommitments(),
        db.listItemTypes().catch(() => []), db.listSettings().catch(() => ({})),
      ]);
      setItemTypes(t); setTypes(t); setSettings(st); setHolders(hs);
      setBins(b); setInv(i); setCommitments(c); setErr('');
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
            <a href="#/">Request</a>
            <a href="#/requests">My requests</a>
          </nav>
        </div>
      </header>

      {err && <div className="shell warn-wrap"><div className="warn">⚠ {err}</div></div>}

      {!loaded ? (
        <div className="shell loading">Opening the bins…</div>
      ) : route.view === 'bin' ? (
        <BinView bin={binByCode.get(route.code)} code={route.code} bins={bins} inv={inv} refresh={refresh} />
      ) : route.view === 'my' ? (
        <MyRequests token={route.token} bins={bins} settings={settings} />
      ) : route.view === 'holder' ? (
        <HolderHome token={route.token} />
      ) : route.view === 'requests' ? (
        <FindMyRequests />
      ) : route.view === 'admin' ? (
        <AdminView sub={route.sub} bins={bins} holders={holders} inv={inv}
          settings={settings} refresh={refresh} />
      ) : (
        <Home bins={bins} inv={inv} commitments={commitments} refresh={refresh} />
      )}

      <footer className="foot">
        <div className="shell">
          <p>
            Questions, donations, or a bin of your own?{' '}
            {CONTACT.name ? <><b>{CONTACT.name}</b> · </> : null}
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>
          </p>
          <p className="foot-fine">Parent-run, alongside RCA. · <a href="#/admin">Storage Room</a></p>
        </div>
      </footer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Home — search everything, request an item.
// ---------------------------------------------------------------------------
function Home({ bins, inv, commitments, refresh }) {
  const [type, setType] = useState('');
  const [size, setSize] = useState('');
  const [house, setHouse] = useState('all'); // 'all' | '' (any-house) | house id
  const [sheet, setSheet] = useState(null); // { itemType, size, house } or 'waitlist'
  const [offering, setOffering] = useState(false);

  const assigned = commitments; // already only what's promised out, no people

  // A family says what they need; the matching happens out of sight. Showing
  // bin contents here only ever raised questions — whether a count was a size,
  // whether a list was other people's requests, why the thing on screen wasn't
  // reserved for them. None of that is a parent's problem to solve.
  const requesterHouse = house === 'all' ? '' : house;
  const needsHouse = typeHoused(type) && house === 'all';
  const ready = !!type && !!size && !needsHouse;

  const ask = () => setSheet({
    itemType: type,
    size,
    // Polos and vests belong to a house; khakis and dress shirts fit anyone.
    house: typeHoused(type) ? requesterHouse : '',
    requesterHouse,
  });

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
            }}>I'm looking for an item</a>
            <button className="btn ghost-night" onClick={() => setOffering(true)}>
              I have clothes to donate
            </button>
          </div>
        </div>
      </section>

      <section className="shell section" id="find">
        <h2 className="h2">Request an item</h2>
        <p className="sub">
          Tell us what your student needs. We'll find it in a bin and text you
          when it's ready — or put you on the list and text you the moment one
          turns up.
        </p>
        <div className="filters">
          <select value={house} onChange={(e) => setHouse(e.target.value)}>
            <option value="all">Choose your house</option>
            {HOUSES.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
            <option value="">My student is new / not sorted yet</option>
          </select>
          <select
            value={type}
            onChange={(e) => {
              const t = e.target.value;
              setType(t);
              // A size from another set would mean nothing for this item.
              if (size && t && !sizeGroups(t).some((g) => g.sizes.some((x) => x.v === size))) {
                setSize('');
              }
            }}>
            <option value="">Choose your item</option>
            {visibleItemTypes().map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <SizePicker
            itemType={type} value={size} placeholder="Choose your size"
            onChange={(e) => setSize(e.target.value)}
          />
        </div>

        <button className="btn flame wide" disabled={!ready} onClick={ask}>
          {ready ? `Request ${typeLabel(type)}` : 'Request an item'}
        </button>

        <p className="fine ask-note">
          {needsHouse
            ? `${typeLabel(type)}s come in house colors — pick your house above.`
            : !type || !size
              ? 'Pick an item and a size to get started.'
              : "Not sure of the size? Ask anyway — say so in the notes and your bin holder will work it out with you."}
        </p>
      </section>

      {sheet && (
        <RequestSheet
          preset={sheet}
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
    itemType: preset.itemType || visibleItemTypes()[0]?.id || 'polo',
    size: preset.size || firstSize(preset.itemType || visibleItemTypes()[0]?.id),
    house: preset.house || '',
    requesterHouse: preset.requesterHouse ?? preset.house ?? '',
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
              <b>{typeLabel(result.item_type)}{result.house ? ` (${houseInfo(result.house).name})` : ''} · {sizeLabel(result.size)}</b> is with the{' '}
            <b>{bin ? bin.name : 'bin'}</b>{bin?.holder_name ? ` (${bin.holder_name})` : ''}.
            </p>
            <p>
              Next: <a href="#/requests"><b>pick a handoff time</b></a> that works for you —
              carline or straight from student to student.
            </p>
          </>
        ) : (
          <p className="big">
            Nothing in the bins right now, so you're on the <b>waitlist</b> — the moment a match
            is added to any bin we'll match it to you and text you to set up a handoff.
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
          <select
            value={form.itemType}
            onChange={(e) => {
              const itemType = e.target.value;
              setForm({
                ...form, itemType, size: firstSize(itemType),
                house: typeHoused(itemType) ? form.requesterHouse : '',
              });
            }}>
            {visibleItemTypes().map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
        </label>
        <label>Size
          <SizePicker itemType={form.itemType} value={form.size} onChange={set('size')} />
        </label>
      </div>
      <label>Your house
        <select
          value={form.requesterHouse}
          onChange={(e) => {
            const requesterHouse = e.target.value;
            // Polos and vests come in house colors; everything else is neutral,
            // so the family's house only decides which bin we ask first.
            setForm({
              ...form, requesterHouse,
              house: typeHoused(form.itemType) ? requesterHouse : '',
            });
          }}>
          <option value="">My student is new / not sorted yet</option>
          {HOUSES.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
        </select>
      </label>
      <p className="fine">
        We ask your own house's bin first whenever it has the item — that's how the
        swap has always worked.
      </p>
      <div className="grid2">
        <label>Your name *
          <input value={form.parentName} onChange={set('parentName')} placeholder="Danielle" maxLength={60} />
        </label>
        <label>Student (optional)
          <input value={form.student} onChange={set('student')} placeholder="Imani" maxLength={60} />
        </label>
      </div>
      <label>Cell number (optional — it's how we tell you when it's ready)
        <input value={form.contact} onChange={set('contact')} inputMode="tel" placeholder="404-555-1234" maxLength={80} />
      </label>
      <label>Anything else? (optional)
        <input value={form.note} onChange={set('note')} placeholder={FIT_HINT} maxLength={200} />
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
        You'll pick a handoff that fits your week — carline, or student to student. Free, always.
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
      <p className="fine">{DONATION_STANDARD.body}</p>
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
// No public list any more. Without your link there is nothing here to see —
// type your number and we text you a fresh one.
function FindMyRequests() {
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try { await db.requestAccess(phone); } catch { /* say nothing either way */ }
    setSent(true); setBusy(false);
  };

  return (
    <section className="shell section narrow-card">
      <h2 className="h2">My requests</h2>
      {sent ? (
        <>
          <p>
            If we have any requests for that number, we just texted you a private link
            to them. It doesn't expire — save it somewhere handy.
          </p>
          <p className="fine">
            Nothing arrived? The number may not match the one on the request. Email{' '}
            <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a> and we'll sort it out.
          </p>
        </>
      ) : (
        <>
          <p className="sub">
            Every text we send includes your own private link. Lost it? Pop your number
            in and we'll send it again.
          </p>
          <input
            className="search" inputMode="tel" placeholder="404-555-1234"
            value={phone} onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && phone.trim() && send()}
          />
          <button className="btn flame" disabled={busy || !phone.trim()} onClick={send}>
            {busy ? 'Sending…' : 'Text me my link'}
          </button>
          <p className="fine">
            We keep requests private — your name and what you asked for are only ever
            visible to you, your bin holder, and RCAP.
          </p>
        </>
      )}
    </section>
  );
}

// Your requests, and only yours. The token in the link is the key.
function MyRequests({ token, bins, settings }) {
  const [rows, setRows] = useState(null);
  const [picking, setPicking] = useState(null);
  const [err, setErr] = useState('');

  const load = async () => {
    try { setRows(await db.myRequests(token)); }
    catch (e) { setErr(e.message || 'Could not open your requests.'); setRows([]); }
  };
  useEffect(() => { load(); }, [token]);

  const binOf = (id) => bins.find((b) => b.id === id) || null;

  if (rows === null) return <div className="shell loading">Finding your requests…</div>;

  if (!rows.length) {
    return (
      <section className="shell section narrow-card">
        <h2 className="h2">My requests</h2>
        <p>
          Nothing here — either this link has expired or there aren't any requests on
          this number yet.
        </p>
        <a className="btn flame" href="#/">Find an item</a>
      </section>
    );
  }

  const who = rows[0]?.parent_name;

  return (
    <section className="shell section">
      <h2 className="h2">{who ? `${who}'s requests` : 'My requests'}</h2>
      <p className="sub">{myRequestsLead(rows)}</p>
      {err && <p className="err">{err}</p>}
      <ul className="req-list">
        {rows.map((r) => {
          const bin = binOf(r.bin_id);
          const due = r.status === 'scheduled' ? dueInfo(r.due_at) : null;
          const plan = handoffSummary(r);
          return (
            <li key={r.id} className={`req status-${r.status}`}>
              <div className="req-main">
                <b>{typeLabel(r.item_type)} · {sizeLabel(r.size)}{r.qty > 1 ? ` ×${r.qty}` : ''} <HouseTag id={r.house} /></b>
                {r.student && <span>for {r.student}</span>}
                {plan && <span className="plan">🤝 {plan}{bin?.holder_name ? ` · with ${bin.holder_name}` : ''}</span>}
              </div>
              <div className="req-side">
                <span className={`chip chip-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                {due && <span className={`due ${due.urgent ? 'urgent' : ''}`}>{due.label}</span>}

                {r.status === 'assigned' && (
                  <button className="btn small flame" onClick={() => setPicking(r)}>Pick a time</button>
                )}
                {r.status === 'scheduled' && (
                  <button className="linkish" onClick={() => setPicking(r)}>change time</button>
                )}
                {(r.status === 'scheduled' || r.status === 'handed_off') && (
                  <button
                    className="btn small flame"
                    onClick={async () => { await db.handoffReceived(r.id); load(); }}
                  >Got it ✓</button>
                )}
                {(r.status === 'open' || r.status === 'assigned' || r.status === 'scheduled') && (
                  <button
                    className="linkish"
                    onClick={async () => { await db.cancelRequest(r.id); load(); }}
                  >cancel</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>
      <p className="fine">
        This page is yours alone — the link works like a key, so keep it to yourself.
      </p>

      {picking && (
        <HandoffSheet
          req={picking}
          bin={binOf(picking.bin_id)}
          frontDesk={settings?.front_desk_enabled === 'true'}
          onDone={() => { setPicking(null); load(); }}
          onClose={() => setPicking(null)}
        />
      )}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Picking a handoff. The holder already said when they're around, so this is
// just tapping a day — no back-and-forth, no phone tag.
// ---------------------------------------------------------------------------
function HandoffSheet({ req, bin, frontDesk, onDone, onClose }) {
  const [mode, setMode] = useState(
    bin?.offers_carline !== false ? 'carline' : (bin?.offers_student !== false ? 'student' : 'carline')
  );
  const [pick, setPick] = useState(null);
  const [student, setStudent] = useState(req.student || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const slots = nextSlots(bin, new Date(), 6);
  const holder = bin?.holder_name || 'your bin holder';

  const save = async () => {
    setErr('');
    if (mode === 'carline' && !pick) { setErr('Pick a day that works for you.'); return; }
    if (mode === 'other' && !req.contact) {
      setErr('We need a cell on your request so you two can reach each other.'); return;
    }
    if (mode === 'student' && !student.trim()) {
      setErr("We need your student's name so the bag gets to the right hands."); return;
    }
    setBusy(true);
    try {
      await db.scheduleHandoff(
        req.id, mode,
        mode === 'carline' ? pick.date : null,
        mode === 'carline' ? pick.slot : '',
        mode === 'student' ? student.trim() : null
      );
      onDone();
    } catch (e) {
      setErr(e.message || "That didn't save — try again.");
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={onClose} title="Set up the handoff">
      <p className="fine">
        <b>{typeLabel(req.item_type)} · {sizeLabel(req.size)}</b> is with {holder}
        {bin?.code ? ` (${bin.code})` : ''}. How would you like to get it?
      </p>

      <div className="mode-tabs">
        {bin?.offers_carline !== false && (
          <button className={`mode ${mode === 'carline' ? 'on' : ''}`} onClick={() => setMode('carline')}>
            🚗 Carline
          </button>
        )}
        {bin?.offers_student !== false && (
          <button className={`mode ${mode === 'student' ? 'on' : ''}`} onClick={() => setMode('student')}>
            🎒 Student to student
          </button>
        )}
        {bin?.holder?.special_arrangements && (
          <button className={`mode ${mode === 'other' ? 'on' : ''}`} onClick={() => setMode('other')}>
            🤝 Another time
          </button>
        )}
        {frontDesk && (
          <button className={`mode ${mode === 'desk' ? 'on' : ''}`} onClick={() => setMode('desk')}>
            🏫 Front desk
          </button>
        )}
      </div>

      {mode === 'carline' && (
        slots.length ? (
          <>
            <p className="fine">{holder} is around on these days — tap one.</p>
            <div className="slots">
              {slots.map((s) => (
                <button
                  key={s.date + s.slot}
                  className={`slot ${pick && pick.date === s.date && pick.slot === s.slot ? 'on' : ''}`}
                  onClick={() => setPick(s)}
                >{slotLabel(s)}</button>
              ))}
            </div>
            {bin?.carline_spot && <p className="fine">📍 Look for: {bin.carline_spot}</p>}
          </>
        ) : (
          <p className="fine">{holder} hasn't set carline days yet — try student to student.</p>
        )
      )}

      {mode === 'student' && (
        <>
          <p className="fine">
            {holder} sends it in with {bin?.holder_student ? <b>{bin.holder_student}</b> : 'their student'},
            who hands it to yours at school. No coordinating carpool lines.
          </p>
          <label>Your student's name and grade *
            <input value={student} onChange={(e) => setStudent(e.target.value)}
              placeholder="Imani · 6th" maxLength={60} />
          </label>
        </>
      )}

      {mode === 'other' && (
        <>
          <p className="fine">
            {holder} is happy to sort out a time outside morning carline. Choosing this
            shares their cell with you so the two of you can arrange it directly — the
            app steps out of the way here, so it's on you both to make it happen.
          </p>
          {bin?.holder?.special_note && (
            <p className="fine">📝 {bin.holder.special_note}</p>
          )}
        </>
      )}

      {mode === 'desk' && (
        <p className="fine">{holder} drops it at the RCA front desk with your name on it.</p>
      )}

      {err && <p className="err">{err}</p>}
      <button className="btn flame wide" disabled={busy} onClick={save}>
        {busy ? 'Setting it up…' : 'Confirm handoff'}
      </button>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// A bin holder's own page. The bin QR is fine when you're standing over one
// bin, but a person carrying three of them needs somewhere that shows the lot:
// everything they owe, everything to collect, and one grid to punch in counts.
// ---------------------------------------------------------------------------
function HolderHome({ token }) {
  const [data, setData] = useState(undefined);
  const [tab, setTab] = useState('todo');
  const [printBins, setPrintBins] = useState(null);

  const load = () => db.holderHome(token).then(setData).catch(() => setData(null));
  useEffect(() => { load(); }, [token]);

  if (data === undefined) return <div className="shell loading">Opening your bins…</div>;
  if (!data) {
    return (
      <section className="shell section narrow-card">
        <h2 className="h2">Hmm</h2>
        <p>That link doesn't open anything. Check the text it came in, or email{' '}
          <a href={`mailto:${CONTACT.email}`}>{CONTACT.email}</a>.</p>
      </section>
    );
  }

  const { holder, bins, inventory, queue, pickups } = data;
  const live = bins.filter((b) => !b.retired);
  const todo = queue.length + pickups.length;

  // Setup ticks itself off as they actually do it, then disappears for good.
  const counted = (inventory || []).some((i) => i.qty > 0);
  const scheduled = !!holder.availability_set_at;
  const settingUp = !counted || !scheduled;

  if (printBins) {
    return (
      <section className="print-sheet">
        <button className="btn no-print" onClick={() => setPrintBins(null)}>← Back</button>
        <button className="btn flame no-print" onClick={() => window.print()}>Print</button>
        <div className="labels">
          {printBins.map((b) => (
            <div className="label" key={b.id}>
              <div dangerouslySetInnerHTML={{ __html: qrSvg(binUrl(b.code), 240) }} />
              <b>{b.name}</b>
              {b.focus && <span>Mostly {b.focus}</span>}
              <span>In the care of {holder.name}</span>
              <span>Scan to see inside · add what you drop in</span>
              <code>{b.code} · wearercap.org/uniform-exchange</code>
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <>
      <section className="hero bin-hero">
        <div className="shell">
          <p className="kicker">Bin holder{holder.house ? ` · ${houseInfo(holder.house).name}` : ''}</p>
          <h1>{holder.name}</h1>
          <p className="intro">
            {live.length} bin{live.length === 1 ? '' : 's'} in your care
            {todo > 0 ? ` · ${todo} thing${todo === 1 ? '' : 's'} needing you` : ' · nothing needs you right now'}
          </p>
        </div>
      </section>

      <div className="shell">
        <div className="mode-tabs page-tabs">
          {[['todo', `To do${todo ? ` (${todo})` : ''}`], ['counts', 'My bins'], ['me', 'My setup']]
            .map(([k, label]) => (
              <button key={k} className={`mode ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
                {label}
              </button>
            ))}
        </div>
      </div>

      {tab === 'todo' && settingUp && (
        <GettingStarted
          holder={holder} counted={counted} scheduled={scheduled}
          hasBins={live.length > 0} go={setTab}
        />
      )}

      {tab === 'todo' && (
        <HolderTodo holder={holder} bins={bins} queue={queue} pickups={pickups} reload={load} />
      )}

      {tab === 'counts' && (
        <CountSheet
          token={token} holder={holder} bins={live} inventory={inventory} reload={load}
          onPrint={() => setPrintBins(live)}
        />
      )}

      {tab === 'me' && (
        <>
          <section className="shell section">
            <h2 className="h2">When you're around</h2>
            <p className="sub">
              Set this once — every family who requests from any of your bins picks
              from it, so nobody has to text back and forth.
            </p>
            <AvailabilityCard bin={holder} token={token} refresh={load} />
          </section>
          <section className="shell section">
            <h2 className="h2">You &amp; your alerts</h2>
            <HolderSettings token={token} holder={holder} reload={load} />
          </section>
        </>
      )}
    </>
  );
}

// A holder's own details. Nobody should have to email an admin to change
// their phone number, and a volunteer pinged all afternoon stops reading the
// pings — so how they hear from us is theirs to choose too.
function HolderSettings({ token, holder, reload }) {
  const [f, setF] = useState({
    phone: prettyPhone(holder.phone || ''),
    email: holder.email || '',
    notifyMode: holder.notify_mode || 'instant',
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    setBusy(true); setMsg('');
    try {
      await db.holderUpdateSelf(token, f);
      setMsg('Saved.'); reload();
    } catch (e) {
      setMsg(e.message || "That didn't save — try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="card avail">
      <div className="avail-body">
        <label>Your cell — where request alerts go
          <input value={f.phone} onChange={set('phone')} inputMode="tel"
            placeholder="404-555-1234" maxLength={40} />
        </label>
        <label>Your email
          <input value={f.email} onChange={set('email')} inputMode="email" maxLength={120} />
        </label>
      </div>

      <div className="avail-body">
        <p className="fine">How would you like to hear about requests?</p>
        <div className="pick-row">
          {[['instant', 'Right away', 'A text the moment a family requests something.'],
            ['daily', 'End of day', 'One round-up around 5pm with everything from that day.']]
            .map(([v, label, blurb]) => (
              <button
                key={v}
                className={`pick ${f.notifyMode === v ? 'on' : ''}`}
                onClick={() => setF({ ...f, notifyMode: v })}
              >
                <b>{label}</b><span>{blurb}</span>
              </button>
            ))}
        </div>
      </div>

      {msg && <p className="fine">{msg}</p>}
      <div className="avail-actions">
        <button className="btn small flame" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save my settings'}
        </button>
      </div>
    </div>
  );
}

// Three things, and it says which one is still waiting. Once both jobs are
// done this never shows again — nobody wants a tutorial on their fifth visit.
function GettingStarted({ holder, counted, scheduled, hasBins, go }) {
  const steps = [
    {
      done: counted,
      title: 'Count what you already have',
      body: hasBins
        ? 'A grid under My bins, pre-filled with anything we know about. Type roughly what’s in there and save — rough is fine, it’s a bin.'
        : 'No bin assigned to you yet. RCAP will sort that out and it’ll show up here.',
      cta: hasBins ? ['My bins', 'counts'] : null,
    },
    {
      done: scheduled,
      title: 'Say which mornings work',
      body: 'Handoffs happen at morning drop-off. Tap your easy days and add how a family will spot you — “blue Highlander, I park by the gym.” You can also offer to send things in with your own student.',
      cta: ['My setup', 'me'],
    },
    {
      done: false, informational: true,
      title: 'Then just watch for texts',
      body: 'When a family requests something from your bin we’ll text you what it is, who it’s for, and the morning they picked. Bag it, hand it over, tap “Handed it off.” That’s the job.',
      cta: null,
    },
  ];

  return (
    <section className="shell section">
      <div className="card start-card">
        <h3>Welcome, {holder.name.split(' ')[0]} 👋</h3>
        <p className="fine">
          Two quick things and you’re set up. This disappears once they’re done.
        </p>
        <ol className="start-steps">
          {steps.map((s, i) => (
            <li key={s.title} className={s.done ? 'done' : ''}>
              <span className="start-mark">{s.done ? '✓' : s.informational ? '·' : i + 1}</span>
              <div>
                <b>{s.title}</b>
                <span>{s.body}</span>
                {s.cta && !s.done && (
                  <button className="btn small" onClick={() => go(s.cta[1])}>{s.cta[0]} →</button>
                )}
              </div>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function HolderTodo({ holder, bins, queue, pickups, reload }) {
  const binCode = (id) => bins.find((b) => b.id === id)?.code || '';

  if (!queue.length && !pickups.length) {
    return (
      <section className="shell section">
        <p className="empty">
          Nothing waiting on you. When a family requests something from one of your
          bins, it lands here and we text you.
        </p>
      </section>
    );
  }

  return (
    <>
      {queue.length > 0 && (
        <section className="shell section">
          <h2 className="h2 flame-text">Hand these off 🤝</h2>
          <ul className="req-list">
            {queue.map((r) => {
              const due = dueInfo(r.due_at);
              const plan = handoffSummary(r);
              return (
                <li key={r.id} className={`req holder ${due?.overdue ? 'overdue' : ''}`}>
                  <div className="req-main">
                    <b>{typeLabel(r.item_type)} · {sizeLabel(r.size)}{r.qty > 1 ? ` ×${r.qty}` : ''} <HouseTag id={r.house} /></b>
                    <span>
                      for {r.parent_name}{r.student ? ` (${r.student})` : ''}
                      {r.note ? ` — “${r.note}”` : ''}
                    </span>
                    <span className="plan">
                      {binCode(r.bin_id)}{' · '}
                      {r.status === 'assigned' ? '⏳ waiting on them to pick a time'
                        : r.status === 'handed_off' ? `✅ handed off · ${plan} — waiting on them to confirm`
                        : `🤝 ${plan}`}
                    </span>
                  </div>
                  <div className="req-side">
                    {due && r.status === 'scheduled' &&
                      <span className={`due ${due.urgent ? 'urgent' : ''}`}>{due.label}</span>}
                    {r.status !== 'handed_off' && (
                      <button className="btn small flame"
                        onClick={async () => { await db.handoffSent(r.id, holder.name); reload(); }}>
                        Handed it off ✓
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {pickups.length > 0 && (
        <section className="shell section">
          <h2 className="h2">Pickups to arrange</h2>
          <p className="sub">Reach out, grab the bag, then add what came in under My bins.</p>
          <ul className="req-list">
            {pickups.map((o) => (
              <li key={o.id} className="req holder">
                <div className="req-main">
                  <b>{o.parent_name}{o.contact ? ` · ${prettyPhone(o.contact)}` : ''}</b>
                  <span>{o.items_desc}</span>
                </div>
                <div className="req-side">
                  {o.status === 'open' ? (
                    <button className="btn small" onClick={async () => { await db.updateOffer(o.id, 'scheduled'); reload(); }}>
                      Pickup arranged
                    </button>
                  ) : <span className="chip chip-assigned">Scheduled</span>}
                  <button className="btn small flame" onClick={async () => { await db.updateOffer(o.id, 'collected'); reload(); }}>
                    Collected ✓
                  </button>
                  <button className="linkish" onClick={async () => { await db.updateOffer(o.id, 'canceled'); reload(); }}>
                    cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// The bin page — what the QR code opens. Inventory, add/take flows, and the
// holder's fulfillment queue.
// ---------------------------------------------------------------------------
function BinView({ bin, code, bins, inv, refresh }) {
  const [mode, setMode] = useState(null); // 'add' | 'take'
  const [log, setLog] = useState(null);
  const [queueData, setQueueData] = useState({ requests: [], offers: [] });

  // A holder sees what's queued to their own bin — and nothing beyond it.
  const loadQueue = () =>
    db.binQueue(code).then(setQueueData).catch(() => setQueueData({ requests: [], offers: [] }));

  useEffect(() => {
    if (bin) {
      db.listMovements(bin.id).then(setLog).catch(() => setLog([]));
      loadQueue();
    }
  }, [bin?.id]);

  const reload = () => { refresh(); loadQueue(); };

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
  const queue = queueData.requests;
  const pickups = queueData.offers;

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
          <h2 className="h2 flame-text">Hand these off 🤝</h2>
          <p className="sub">
            Requests queued to this bin. Once a family picks a time it shows here — bag it up,
            label it with their name, and tap <b>Handed it off</b> when it leaves your hands.
          </p>
          <ul className="req-list">
            {queue.map((r) => {
              const due = dueInfo(r.due_at);
              const plan = handoffSummary(r);
              return (
                <li key={r.id} className={`req holder ${due?.overdue ? 'overdue' : ''}`}>
                  <div className="req-main">
                    <b>{typeLabel(r.item_type)} · {sizeLabel(r.size)}{r.qty > 1 ? ` ×${r.qty}` : ''} <HouseTag id={r.house} /></b>
                    <span>for {r.parent_name}{r.student ? ` (${r.student})` : ''}{r.note ? ` — “${r.note}”` : ''}</span>
                    <span className="plan">
                      {r.status === 'assigned'
                        ? '⏳ waiting on them to pick a time'
                        : r.status === 'handed_off'
                          ? `✅ handed off · ${plan} — waiting on them to confirm`
                          : `🤝 ${plan}`}
                    </span>
                  </div>
                  <div className="req-side">
                    {due && r.status === 'scheduled' &&
                      <span className={`due ${due.urgent ? 'urgent' : ''}`}>{due.label}</span>}
                    {r.status !== 'handed_off' && (
                      <button
                        className="btn small flame"
                        onClick={async () => { await db.handoffSent(r.id, bin.holder_name); reload(); }}
                      >Handed it off ✓</button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {pickups.length > 0 && (
        <section className="shell section">
          <h2 className="h2">Pickups to arrange</h2>
          <p className="sub">Parents offering clothes for this bin. Reach out, grab the bag, then log what came in with “I'm adding items.”</p>
          <ul className="req-list">
            {pickups.map((o) => (
              <li key={o.id} className="req holder">
                <div className="req-main">
                  <b>{o.parent_name}{o.contact ? ` · ${prettyPhone(o.contact)}` : ''}</b>
                  <span>{o.items_desc}</span>
                </div>
                <div className="req-side">
                  {o.status === 'open' ? (
                    <button className="btn small" onClick={async () => { await db.updateOffer(o.id, 'scheduled'); reload(); }}>
                      Pickup arranged
                    </button>
                  ) : (
                    <span className="chip chip-assigned">Scheduled</span>
                  )}
                  <button className="btn small flame" onClick={async () => { await db.updateOffer(o.id, 'collected'); reload(); }}>
                    Collected ✓
                  </button>
                  <button className="linkish" onClick={async () => { await db.updateOffer(o.id, 'canceled'); reload(); }}>
                    cancel
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="shell section">
        <h2 className="h2">When you're around</h2>
        <p className="sub">
          Set this once and every family who requests from your bin picks from it —
          no texting back and forth.
        </p>
        <AvailabilityCard bin={bin} refresh={refresh} />
      </section>

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
                  <span className="size-chip">{sizeLabel(i.size)}</span>
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
                {typeLabel(m.item_type)}{m.house ? ` (${houseInfo(m.house).name})` : ''} · {sizeLabel(m.size)}
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
          onDone={() => { setMode(null); reload(); db.listMovements(bin.id).then(setLog); }}
          onClose={() => setMode(null)}
        />
      )}
    </>
  );
}

// The holder answers "when are you around?" once. Everything downstream —
// the dates a requester taps, the texts — comes from this.
function AvailabilityCard({ bin, token, refresh }) {
  const holderId = bin.holder_id;
  const [open, setOpen] = useState(false);
  const [f, setF] = useState({
    offersCarline: bin.offers_carline !== false,
    offersStudent: bin.offers_student !== false,
    days: bin.carline_days && bin.carline_days.length ? bin.carline_days : [1, 2, 3, 4, 5],
    when: 'am', // handoffs happen at morning carline; afternoons are chaos
    spot: bin.carline_spot || '',
    holderStudent: bin.holder_student || bin.student || '',
    special: !!bin.special_arrangements,
    specialNote: bin.special_note || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const toggleDay = (n) =>
    setF({ ...f, days: f.days.includes(n) ? f.days.filter((d) => d !== n) : [...f.days, n].sort() });

  const save = async () => {
    setBusy(true); setErr('');
    try {
      if (token) await db.setAvailabilityByToken(token, f);
      else if (holderId) await db.setHolderAvailability(holderId, f);
      else await db.setAvailability(bin.id, f);
      setOpen(false); refresh();
    } catch (e) {
      setErr(e.message || "That didn't save — try again.");
    } finally { setBusy(false); }
  };

  if (!open) {
    return (
      <div className="card avail">
        <div className="avail-now">
          <b>{availabilityLine(bin)}</b>
          {bin.carline_spot && <span>📍 {bin.carline_spot}</span>}
        </div>
        <button className="btn small" onClick={() => setOpen(true)}>Edit my availability</button>
        <p className="fine">This is your schedule — it covers every bin you hold.</p>
      </div>
    );
  }

  return (
    <div className="card avail">
      <label className="check">
        <input type="checkbox" checked={f.offersCarline}
          onChange={(e) => setF({ ...f, offersCarline: e.target.checked })} />
        <span>🚗 I can hand off at carline</span>
      </label>

      {f.offersCarline && (
        <div className="avail-body">
          <p className="fine">
            Which mornings are easy for you? Handoffs happen at <b>morning drop-off</b> —
            afternoon carline is too rushed. Anything else, you two can arrange directly.
          </p>
          <div className="daypick">
            {WEEKDAYS.map((w) => (
              <button
                key={w.n}
                className={`day ${f.days.includes(w.n) ? 'on' : ''}`}
                onClick={() => toggleDay(w.n)}
              >{w.short}</button>
            ))}
          </div>
          <label>How will they spot you? (optional)
            <input value={f.spot} onChange={(e) => setF({ ...f, spot: e.target.value })}
              placeholder="Blue Highlander, I park by the gym" maxLength={120} />
          </label>
        </div>
      )}

      <label className="check">
        <input type="checkbox" checked={f.offersStudent}
          onChange={(e) => setF({ ...f, offersStudent: e.target.checked })} />
        <span>🎒 I can send it in with my student</span>
      </label>

      {f.offersStudent && (
        <div className="avail-body">
          <label>Your student's name and grade
            <input value={f.holderStudent} onChange={(e) => setF({ ...f, holderStudent: e.target.value })}
              placeholder="Cayenne · 7th" maxLength={80} />
          </label>
        </div>
      )}

      <label className="check">
        <input type="checkbox" checked={f.special}
          onChange={(e) => setF({ ...f, special: e.target.checked })} />
        <span>🤝 I'll arrange another time if neither works</span>
      </label>

      {f.special && (
        <div className="avail-body">
          <p className="fine">
            Families see this alongside carline, and picking it shares your cell with
            that one family so the two of you can sort it out directly.
          </p>
          <label>Anything they should know? (optional)
            <input value={f.specialNote} onChange={(e) => setF({ ...f, specialNote: e.target.value })}
              placeholder="Evenings are easiest, I'm near the school" maxLength={200} />
          </label>
        </div>
      )}

      {err && <p className="err">{err}</p>}
      <div className="avail-actions">
        <button className="btn small flame" disabled={busy} onClick={save}>
          {busy ? 'Saving…' : 'Save availability'}
        </button>
        <button className="linkish" onClick={() => setOpen(false)}>cancel</button>
      </div>
    </div>
  );
}

// Counting a whole bin at once. Nobody setting up for the first time wants to
// log twenty polos one at a time — so this is a grid: every line already in the
// bin, pre-filled, plus blank rows to add to. You type what's actually there
// and hit save; the database works out the difference and logs that.
// A holder's bins, and the two things they'll ever want to do to one: call it
// what they actually call it, and add another when the first one fills up.
// No passcode — their token already says who they are.
function BinBar({ token, bins, binId, setBinId, reload }) {
  const [mode, setMode] = useState('');            // '' | 'rename' | 'add'
  const [f, setF] = useState({ name: '', focus: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  const bin = bins.find((b) => b.id === binId);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const open = (which) => {
    setErr('');
    setF(which === 'rename' && bin ? { name: bin.name, focus: bin.focus || '' } : { name: '', focus: '' });
    setMode(which);
  };

  const save = async () => {
    setBusy(true); setErr('');
    try {
      if (mode === 'add') {
        const made = await db.holderAddBin(token, f.name, f.focus);
        if (made?.id) setBinId(made.id);
      } else {
        await db.holderRenameBin(token, binId, f.name, f.focus);
      }
      setMode('');
      reload();
    } catch (e) {
      setErr(e.message || "That didn't save — try again.");
    } finally { setBusy(false); }
  };

  return (
    <div className="binbar">
      {bins.length > 1 && (
        <div className="mode-tabs">
          {bins.map((b) => (
            <button key={b.id} className={`mode ${b.id === binId ? 'on' : ''}`}
              onClick={() => { setMode(''); setBinId(b.id); }}>
              {b.name}
            </button>
          ))}
        </div>
      )}

      {mode === '' && (
        <p className="fine binbar-meta">
          {bin && <><b>{bin.code}</b>{bin.focus ? ` · mostly ${bin.focus}` : ''} · </>}
          {bin && <button className="linkish" onClick={() => open('rename')}>Rename this bin</button>}
          {bin && ' · '}
          <button className="linkish" onClick={() => open('add')}>
            {bins.length ? 'Add another bin' : 'Start my first bin'}
          </button>
        </p>
      )}

      {mode !== '' && (
        <div className="avail-body binbar-form">
          <label>{mode === 'add' ? 'Name your new bin' : 'Bin name'}
            <input value={f.name} maxLength={60} placeholder="The bin in my trunk"
              onChange={set('name')} />
          </label>
          <label>Mostly full of (optional)
            <input value={f.focus} maxLength={40} placeholder="polos, bottoms, small sizes…"
              onChange={set('focus')} />
          </label>
          {err && <p className="fine">{err}</p>}
          <div className="avail-actions">
            <button className="btn flame" disabled={busy} onClick={save}>
              {busy ? 'Saving…' : mode === 'add' ? 'Add the bin' : 'Save name'}
            </button>
            <button className="linkish" onClick={() => setMode('')}>Cancel</button>
          </div>
          {mode === 'add' && (
            <p className="fine">
              We'll give it its own code and QR label — print it from the bottom of this page.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function CountSheet({ token, holder, bins, inventory, reload, onPrint }) {
  const [binId, setBinId] = useState(bins[0]?.id || '');
  const [rows, setRows] = useState([]);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');

  const blank = () => ({
    key: Math.random().toString(36).slice(2),
    item_type: visibleItemTypes()[0]?.id || 'polo',
    size: firstSize(visibleItemTypes()[0]?.id),
    house: typeHoused(visibleItemTypes()[0]?.id) ? (holder.house || '') : '',
    qty: 1,
    existing: false,
  });

  // Reload the grid whenever the bin (or the underlying counts) change.
  useEffect(() => {
    const mine = (inventory || [])
      .filter((i) => i.bin_id === binId && i.qty !== 0)
      .sort((a, b) => a.item_type.localeCompare(b.item_type) || a.size.localeCompare(b.size))
      .map((i) => ({
        key: `${i.item_type}|${i.size}|${i.house || ''}`,
        item_type: i.item_type, size: i.size, house: i.house || '',
        qty: Math.max(0, i.qty), existing: true,
      }));
    setRows(mine.length ? mine : [blank()]);
    setMsg('');
  }, [binId, inventory]);

  const set = (key, patch) =>
    setRows((rs) => rs.map((r) => (r.key === key ? { ...r, ...patch } : r)));

  const save = async () => {
    setBusy(true); setMsg('');
    try {
      const lines = rows
        .filter((r) => r.item_type && r.size)
        .map((r) => ({
          bin_id: binId, item_type: r.item_type, size: r.size,
          house: r.house || '', qty: Number(r.qty) || 0,
        }));
      const changed = await db.setHolderInventory(token, lines, holder.name);
      setMsg(changed ? `Saved — ${changed} line${changed === 1 ? '' : 's'} updated.` : 'Nothing had changed.');
      reload();
    } catch (e) {
      setMsg(e.message || "That didn't save — try again.");
    } finally { setBusy(false); }
  };

  if (!bins.length) {
    return (
      <section className="shell section">
        <h2 className="h2">My bins</h2>
        <p className="sub">
          Nothing in your care yet — a bin is just a tub in your trunk with a QR
          label on it. Start one and we'll give it a code.
        </p>
        <BinBar token={token} bins={bins} binId={binId} setBinId={setBinId} reload={reload} />
      </section>
    );
  }

  const bin = bins.find((b) => b.id === binId);

  return (
    <section className="shell section">
      <h2 className="h2">My bins</h2>
      <p className="sub">
        Type what's actually in the bin — rough is fine, it's a bin. Everything
        already counted is here; add lines for anything new.
      </p>

      <BinBar token={token} bins={bins} binId={binId} setBinId={setBinId} reload={reload} />

      <ul className="count-grid">
        {rows.map((r) => (
          <li key={r.key}>
            <div className="count-what">
              <select
                value={r.item_type}
                onChange={(e) => {
                  const t = e.target.value;
                  set(r.key, {
                    item_type: t,
                    size: firstSize(t),
                    house: typeHoused(t) ? (r.house || holder.house || '') : '',
                  });
                }}>
                {visibleItemTypes().map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
              </select>
              <SizePicker itemType={r.item_type} value={r.size}
                onChange={(e) => set(r.key, { size: e.target.value })} />
              {typeHoused(r.item_type) && (
                <select value={r.house} onChange={(e) => set(r.key, { house: e.target.value })}>
                  {HOUSE_CHOICES.map((h) => (
                    <option key={h.id || 'any'} value={h.id}>{h.id ? h.name : 'Any house'}</option>
                  ))}
                </select>
              )}
            </div>
            <div className="count-qty">
              <button className="step" onClick={() => set(r.key, { qty: Math.max(0, (Number(r.qty) || 0) - 1) })}>−</button>
              <input
                type="number" inputMode="numeric" min="0" max="99" value={r.qty}
                onChange={(e) => set(r.key, { qty: e.target.value })}
              />
              <button className="step" onClick={() => set(r.key, { qty: Math.min(99, (Number(r.qty) || 0) + 1) })}>+</button>
              <button className="linkish" onClick={() => setRows((rs) => rs.filter((x) => x.key !== r.key))}>
                remove
              </button>
            </div>
          </li>
        ))}
      </ul>

      <button className="btn ghost" onClick={() => setRows((rs) => [...rs, blank()])}>
        ＋ Another line
      </button>

      {msg && <p className="fine">{msg}</p>}
      <button className="btn flame wide" disabled={busy} onClick={save}>
        {busy ? 'Saving…' : `Save ${bin ? bin.code : ''} counts`}
      </button>

      <p className="fine count-foot">
        Every change is logged, so the history still shows what moved and when.
        {' '}<button className="linkish" onClick={onPrint}>Print my QR labels</button>
      </p>
    </section>
  );
}

// Add / take items — a running list so a whole grocery bag logs in one go.
function MoveSheet({ bin, sign, onDone, onClose }) {
  const [lines, setLines] = useState([]);
  const [cur, setCur] = useState({
    itemType: visibleItemTypes()[0]?.id || 'polo',
    size: firstSize(visibleItemTypes()[0]?.id), qty: 1,
    // House bins mostly hold their own house's gear — start there.
    house: typeHoused(visibleItemTypes()[0]?.id) ? (bin.holder_house || '') : '',
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
                size: firstSize(itemType),
                house: typeHoused(itemType) ? (cur.house || bin.holder_house || '') : '',
              });
            }}>
            {visibleItemTypes().map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
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
          <SizePicker itemType={cur.itemType} value={cur.size}
            onChange={(e) => setCur({ ...cur, size: e.target.value })} />
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
              {sign > 0 ? '+' : '−'}{l.qty} {typeLabel(l.itemType)}{l.house ? ` (${houseInfo(l.house).name})` : ''} · {sizeLabel(l.size)}
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
// The Storage Room — passcode-gated in the database, like the Recap.
// ---------------------------------------------------------------------------
function AdminView({ sub, bins, holders, inv, settings, refresh }) {
  const [pass, setPass] = useState(sessionStorage.getItem('ue-pass') || '');
  const [ok, setOk] = useState(false);
  const [msg, setMsg] = useState('');
  const [printBins, setPrintBins] = useState(null);
  const [data, setData] = useState({ requests: [], offers: [], notifications: [] });

  // Requests, offers and the text log are no longer readable with the anon key,
  // so the passcode is what actually fetches them.
  const loadAdmin = async (p) => {
    const d = await db.adminData(p);
    setData(d); setOk(true); setMsg('');
    return d;
  };

  useEffect(() => {
    const saved = sessionStorage.getItem('ue-pass');
    if (saved) loadAdmin(saved).catch(() => { sessionStorage.removeItem('ue-pass'); setOk(false); });
  }, []);

  const tryPass = async () => {
    try {
      await loadAdmin(pass);
      sessionStorage.setItem('ue-pass', pass);
    } catch {
      setMsg("That passcode isn't it.");
    }
  };

  if (!ok) {
    return (
      <section className="shell section narrow-card">
        <h2 className="h2">Storage Room</h2>
        <p className="sub">For whoever runs the exchange.</p>
        <input className="search" type="password" placeholder="Passcode" value={pass}
          onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && tryPass()} />
        {msg && <p className="err">{msg}</p>}
        <button className="btn flame" onClick={tryPass}>Open</button>
        <HolderDoor />
      </section>
    );
  }

  const act = async (fn) => {
    try {
      await fn(); setMsg(''); refresh();
      await loadAdmin(pass).catch(() => {});
    } catch (e) { setMsg(e.message || 'Nope.'); }
  };

  if (printBins) {
    return (
      <section className="print-sheet">
        <button className="btn no-print" onClick={() => setPrintBins(null)}>← Back</button>
        <button className="btn flame no-print" onClick={() => window.print()}>Print</button>
        <div className="labels">
          {printBins.map((b) => (
            <div className="label" key={b.id}>
              <div dangerouslySetInnerHTML={{ __html: qrSvg(binUrl(b.code), 240) }} />
              <b>{b.name}</b>
              {b.focus && <span>Mostly {b.focus}</span>}
              {b.holder_name && <span>In the care of {b.holder_name}</span>}
              <span>Scan to see inside · add what you drop in</span>
              <code>{b.code} · wearercap.org/uniform-exchange</code>
            </div>
          ))}
        </div>
      </section>
    );
  }

  const shared = {
    pass, act, msg, bins, refresh, setPrintBins,
    holders: data.holders.length ? data.holders : holders,
    reqs: data.requests, notifications: data.notifications,
  };
  if (sub === 'bins')     return <AdminBins {...shared} />;
  if (sub === 'requests') return <AdminRequests {...shared} />;
  if (sub === 'settings' || sub === 'types') return <AdminSettings {...shared} settings={settings} />;
  if (sub === 'inventory') return <AdminInventory {...shared} inv={inv} />;
  return <AdminHome {...shared} inv={inv} offers={data.offers} />;
}

// Bin holders don't get a passcode — they get their page texted to them.
function HolderDoor() {
  const [phone, setPhone] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const send = async () => {
    setBusy(true);
    try { await db.holderRequestLink(phone); } catch { /* say nothing either way */ }
    setSent(true); setBusy(false);
  };

  return (
    <div className="card holder-door">
      <h3>Hold a bin?</h3>
      {sent ? (
        <p className="fine">
          If that number is on a bin, we just texted your page. It doesn't expire —
          save it somewhere handy.
        </p>
      ) : (
        <>
          <p className="fine">
            No passcode for you — pop in your cell and we'll text your own page.
          </p>
          <input
            className="search" inputMode="tel" placeholder="404-555-1234"
            value={phone} onChange={(e) => setPhone(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && phone.trim() && send()}
          />
          <button className="btn small" disabled={busy || !phone.trim()} onClick={send}>
            {busy ? 'Sending…' : 'Text me my page'}
          </button>
        </>
      )}
    </div>
  );
}

// A back-office page header with a way back to the dashboard.
function AdminPage({ title, children, msg }) {
  return (
    <section className="shell section">
      <a className="crumb" href="#/admin">← Storage Room</a>
      <h2 className="h2">{title}</h2>
      {msg && <p className="err">{msg}</p>}
      {children}
    </section>
  );
}

// The dashboard is only what needs attention today. Everything you *manage*
// lives one tap away.
function AdminHome({ pass, act, msg, bins, holders, reqs, inv, offers, notifications, refresh, setPrintBins }) {
  const waitlist = reqs.filter((r) => r.status === 'open');
  const needsTime = reqs.filter((r) => r.status === 'assigned');
  const pending = reqs.filter((r) => ['open','assigned','scheduled','handed_off'].includes(r.status));
  const overdue = reqs.filter(
    (r) => ['scheduled','handed_off'].includes(r.status) && dueInfo(r.due_at)?.overdue
  );
  const onHand = totals(inv).reduce((n, t) => n + t.qty, 0);
  return (
    <section className="shell section">
      <h2 className="h2">Storage Room</h2>
      {msg && <p className="err">{msg}</p>}

      <div className="admin-nav">
        <a href="#/admin/requests">
          <b>Requests</b><span>{pending.length} in flight</span>
        </a>
        <a href="#/admin/bins">
          <b>Bins &amp; holders</b>
          <span>{holders.filter((h) => h.active !== false).length} people · {bins.filter((b) => !b.retired).length} bins</span>
        </a>
        <a href="#/admin/inventory">
          <b>What's on hand</b><span>{onHand} items · by house, by bin</span>
        </a>
        <a href="#/admin/settings">
          <b>Settings</b><span>Item types · handoff · texts</span>
        </a>
      </div>

      {overdue.length > 0 && (
        <div className="card overdue-card">
          <h3>⏰ Handoffs that haven't closed</h3>
          <ul className="plainlist">
            {overdue.map((r) => (
              <li key={r.id}>
                <b>{typeLabel(r.item_type)} · {sizeLabel(r.size)}</b> for {r.parent_name}
                {r.contact ? ` (${prettyPhone(r.contact)})` : ''} — {bins.find((b) => b.id === r.bin_id)?.holder_name || 'bin'}
                , {handoffSummary(r) || 'no plan'} · {dueInfo(r.due_at).label}
              </li>
            ))}
          </ul>
          <p className="fine">
            Either the handoff slipped or nobody tapped “Got it.”{' '}
            <a href="#/admin/requests">Fix them here</a>.
          </p>
        </div>
      )}

      {(needsTime.length > 0 || waitlist.length > 0) && (
        <div className="card">
          <h3>Needs a nudge</h3>
          <ul className="plainlist">
            {needsTime.length > 0 && (
              <li>{needsTime.length} waiting on a family to pick a handoff time</li>
            )}
            {waitlist.length > 0 && (
              <li>{waitlist.length} on the waitlist with nothing in stock yet</li>
            )}
          </ul>
          <p className="fine"><a href="#/admin/requests">Open requests</a></p>
        </div>
      )}

      <AdminOffers bins={bins} offers={offers} refresh={refresh} />
      <AdminReports bins={bins} inv={inv} reqs={reqs} />
      <AdminNotifications notifications={notifications} />
    </section>
  );
}

// ---------------------------------------------------------------------------
// Every request still in flight, and the levers to fix one: move it to another
// bin, put it back on the waitlist, close it, or cancel it.
// ---------------------------------------------------------------------------
function AdminRequests({ pass, act, msg, bins, reqs }) {
  const [tab, setTab] = useState('pending');
  const [editing, setEditing] = useState(null);

  const pending = reqs.filter((r) => ['open','assigned','scheduled','handed_off'].includes(r.status));
  const shown = tab === 'pending' ? pending
    : tab === 'done' ? reqs.filter((r) => r.status === 'fulfilled')
    : reqs.filter((r) => r.status === 'canceled');

  const binOf = (id) => bins.find((b) => b.id === id);

  return (
    <AdminPage title="Requests" msg={msg}>
      <div className="mode-tabs">
        {[['pending', `In flight (${pending.length})`], ['done', 'Received'], ['canceled', 'Canceled']]
          .map(([k, label]) => (
            <button key={k} className={`mode ${tab === k ? 'on' : ''}`} onClick={() => setTab(k)}>
              {label}
            </button>
          ))}
      </div>

      <ul className="req-list">
        {shown.length === 0 && <li className="empty">Nothing here.</li>}
        {shown.map((r) => {
          const bin = binOf(r.bin_id);
          const due = ['scheduled','handed_off'].includes(r.status) ? dueInfo(r.due_at) : null;
          return (
            <li key={r.id} className={`req ${due?.overdue ? 'overdue' : ''}`}>
              <div className="req-main">
                <b>{typeLabel(r.item_type)} · {sizeLabel(r.size)}{r.qty > 1 ? ` ×${r.qty}` : ''} <HouseTag id={r.house} /></b>
                <span>
                  {r.parent_name}{r.student ? ` · ${r.student}` : ''}
                  {r.contact ? ` · ${prettyPhone(r.contact)}` : ' · no contact'}
                </span>
                <span className="plan">
                  {bin ? `${bin.code} · ${bin.holder_name || 'no holder'}` : 'no bin yet'}
                  {handoffSummary(r) ? ` · 🤝 ${handoffSummary(r)}` : ''}
                  {` · asked ${fmtDay(r.created_at)}`}
                </span>
              </div>
              <div className="req-side">
                <span className={`chip chip-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                {due && <span className={`due ${due.urgent ? 'urgent' : ''}`}>{due.label}</span>}
                {['open','assigned','scheduled','handed_off'].includes(r.status) && (
                  <button className="btn small" onClick={() => setEditing(r)}>Edit</button>
                )}
              </div>
            </li>
          );
        })}
      </ul>

      {editing && (
        <RequestEditSheet
          req={editing} bins={bins} pass={pass} act={act}
          onClose={() => setEditing(null)}
        />
      )}
    </AdminPage>
  );
}

function RequestEditSheet({ req, bins, pass, act, onClose }) {
  const [bin, setBin] = useState(req.bin_id || '');
  const [note, setNote] = useState(req.note || '');
  const live = bins.filter((b) => !b.retired);

  const done = (fn) => async () => { await act(fn); onClose(); };

  return (
    <Sheet onClose={onClose} title={`${typeLabel(req.item_type)} · ${sizeLabel(req.size)}`}>
      <p className="fine">
        For <b>{req.parent_name}</b>{req.student ? ` (${req.student})` : ''}
        {req.contact ? ` · ${prettyPhone(req.contact)}` : ''} · asked {fmtDay(req.created_at)}
      </p>

      <label>Move to another bin
        <select value={bin} onChange={(e) => setBin(e.target.value)}>
          <option value="">— pick a bin —</option>
          {live.map((b) => (
            <option key={b.id} value={b.id}>
              {b.code} · {b.holder_name || 'no holder'}{b.focus ? ` (${b.focus})` : ''}
            </option>
          ))}
        </select>
      </label>
      <p className="fine">
        Moving it resets the handoff — the new holder keeps different hours, so the
        family picks a fresh time and both of them get a text.
      </p>
      <button
        className="btn wide"
        disabled={!bin || bin === req.bin_id}
        onClick={done(() => db.adminReassign(pass, req.id, bin))}
      >Move it</button>

      <label style={{ marginTop: 18 }}>Note
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={200} />
      </label>
      <button className="btn ghost wide" onClick={done(() => db.adminRequest(pass, req.id, null, note))}>
        Save note
      </button>

      <div className="sheet-danger">
        <p className="fine">Force the status when real life got ahead of the app:</p>
        <div className="danger-row">
          <button className="btn small ghost" onClick={done(() => db.adminRequest(pass, req.id, 'open'))}>
            Back to waitlist
          </button>
          <button className="btn small flame" onClick={done(() => db.adminRequest(pass, req.id, 'fulfilled'))}>
            Mark received
          </button>
          <button className="linkish" onClick={done(() => db.adminRequest(pass, req.id, 'canceled'))}>
            cancel request
          </button>
        </div>
      </div>
    </Sheet>
  );
}

// ---------------------------------------------------------------------------
// People, and the bins each of them carries.
// ---------------------------------------------------------------------------
function AdminBins({ pass, act, msg, bins, holders, setPrintBins }) {
  const [editHolder, setEditHolder] = useState(null); // 'new' | holder
  const [editBin, setEditBin] = useState(null);       // {holderId} | bin
  const [linkFor, setLinkFor] = useState(null);       // holder whose link we're sharing
  const [links, setLinks] = useState({});

  useEffect(() => { db.adminHolderLinks(pass).then(setLinks).catch(() => {}); }, [pass, holders.length]);

  const binsOf = (hid) => bins.filter((b) => b.holder_id === hid);
  const orphans = bins.filter((b) => !b.holder_id);
  const noPhone = holders.filter((h) => h.active !== false && !(h.phone || '').trim());

  // A house can have several bin holders — group them so you read the roster
  // house by house, the way the community is actually organised.
  const groups = [...HOUSE_CHOICES.filter((h) => h.id), { id: '', name: 'No house / mixed' }]
    .map((house) => ({ house, people: holders.filter((h) => (h.house || '') === house.id) }))
    .filter((g) => g.people.length);

  return (
    <AdminPage title="Bins & holders" msg={msg}>
      <p className="sub">
        Grouped by house, because that's how families find each other. A house can have
        several bin holders, and one parent can carry several bins — a shirt bin and a
        pants bin is normal. Phone, email and schedule live on the person, entered once.
      </p>
      <div className="admin-actions">
        <button className="btn" onClick={() => setEditHolder('new')}>＋ New holder</button>
      </div>

      {noPhone.length > 0 && (
        <div className="card warn-card">
          <h3>📱 {noPhone.length} holder{noPhone.length > 1 ? 's' : ''} with no phone</h3>
          <p className="fine">
            No number means they never hear that a request landed in their bin —
            {' '}{noPhone.map((h) => h.name).join(', ')}. Tap Edit on their card to add it.
          </p>
        </div>
      )}

      {groups.map(({ house, people }) => (
        <div className="house-group" key={house.id || 'none'}>
          <div className="house-head">
            <HouseTag id={house.id} />
            <span>{people.length} bin holder{people.length > 1 ? 's' : ''}</span>
          </div>

      {people.map((h) => {
        const mine = binsOf(h.id);
        return (
          <div className={`card holder-card ${h.active === false ? 'retired' : ''}`} key={h.id}>
            <div className="holder-head">
              <div>
                <b>{h.name}</b>
                <span className={h.phone ? '' : 'missing'}>
                  📱 {h.phone ? prettyPhone(h.phone) : 'no phone — they get no texts'}
                </span>
                <span className={h.email ? '' : 'missing'}>
                  ✉️ {h.email || 'no email on file'}
                </span>
                <span className="fine">{availabilityLine(h)}</span>
              </div>
              <div className="bin-admin-actions">
                <button className="btn small" onClick={() => setEditHolder(h)}>Edit</button>
                {mine.length > 0 && (
                  <button className="linkish" onClick={() => setPrintBins(mine.filter((b) => !b.retired))}>
                    print labels
                  </button>
                )}
                <button className="linkish" onClick={() => setLinkFor(h)}>their page</button>
                <button className="linkish" onClick={() =>
                  act(() => db.adminHolder(pass, h.active === false ? 'restore' : 'deactivate', h.id))}>
                  {h.active === false ? 'restore' : 'retire'}
                </button>
              </div>
            </div>

            <ul className="bin-rows">
              {mine.length === 0 && <li className="fine">No bins yet.</li>}
              {mine.map((b) => (
                <li key={b.id} className={b.retired ? 'retired' : ''}>
                  <a href={`#/bin/${b.code}`}>
                    <b>{b.code}</b> {b.name}{b.focus ? <em> · {b.focus}</em> : null}
                  </a>
                  <div className="bin-admin-actions">
                    <button className="linkish" onClick={() => setEditBin(b)}>edit</button>
                    <button className="linkish" onClick={() => setPrintBins([b])}>label</button>
                    <button className="linkish" onClick={() =>
                      act(() => db.adminBin2(pass, b.retired ? 'restore' : 'retire', b.id))}>
                      {b.retired ? 'restore' : 'retire'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
            <button className="btn small ghost" onClick={() => setEditBin({ holderId: h.id })}>
              ＋ Add a bin for {h.name.split(' ')[0]}
            </button>
          </div>
        );
      })}
        </div>
      ))}

      {orphans.length > 0 && (
        <div className="card">
          <h3>Bins with no holder</h3>
          <ul className="bin-rows">
            {orphans.map((b) => (
              <li key={b.id}>
                <a href={`#/bin/${b.code}`}><b>{b.code}</b> {b.name}</a>
                <button className="linkish" onClick={() => setEditBin(b)}>assign a holder</button>
              </li>
            ))}
          </ul>
        </div>
      )}

      <p className="fine page-foot">
        <button className="linkish" onClick={() => setPrintBins(bins.filter((b) => !b.retired))}>
          🖨 Print every QR label
        </button>{' '}— handy for a stack to hand out; each holder can also print
        their own from their page.
      </p>

      {linkFor && (
        <Sheet onClose={() => setLinkFor(null)} title={`${linkFor.name}'s page`}>
          <p className="fine">
            This is {linkFor.name.split(' ')[0]}'s private page — their bins, anything
            queued to them, and where they update their counts. No password; the link
            is the key, so send it to them rather than posting it anywhere.
          </p>
          <input
            className="search" readOnly
            value={links[linkFor.id] ? holderUrl(links[linkFor.id]) : 'Loading…'}
            onFocus={(e) => e.target.select()}
          />
          <button
            className="btn flame wide"
            disabled={!linkFor.phone}
            onClick={async () => {
              await act(() => db.adminTextHolderLink(pass, linkFor.id));
              setLinkFor(null);
            }}
          >{linkFor.phone ? `Text it to ${prettyPhone(linkFor.phone)}` : 'No cell on file — add one first'}</button>
          <button
            className="btn ghost wide"
            disabled={!linkFor.phone && !linkFor.email}
            onClick={async () => {
              await act(() => db.adminWelcomeHolder(pass, linkFor.id));
              setLinkFor(null);
            }}
          >Send the whole welcome again</button>
          <p className="fine">
            The welcome goes out automatically the moment someone is added with a cell
            or an email — this is for when it needs saying twice.
          </p>
        </Sheet>
      )}

      {editHolder && (
        <HolderSheet
          holder={editHolder === 'new' ? null : editHolder}
          onSave={async (f) => {
            await act(() => db.adminHolder(pass, editHolder === 'new' ? 'create' : 'update',
              editHolder === 'new' ? null : editHolder.id, f));
            setEditHolder(null);
          }}
          onClose={() => setEditHolder(null)}
        />
      )}

      {editBin && (
        <BinSheet
          bin={editBin.id ? editBin : null}
          holders={holders}
          defaultHolderId={editBin.holderId || editBin.holder_id}
          onSave={async (f) => {
            await act(() => db.adminBin2(pass, editBin.id ? 'update' : 'create',
              editBin.id || null, f));
            setEditBin(null);
          }}
          onClose={() => setEditBin(null)}
        />
      )}
    </AdminPage>
  );
}

function HolderSheet({ holder, onSave, onClose }) {
  const [f, setF] = useState({
    name: holder?.name || '', phone: prettyPhone(holder?.phone || ''), email: holder?.email || '',
    house: holder?.house || '', student: holder?.student || '', note: holder?.note || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!f.name.trim()) { setErr('A name is the one thing we need.'); return; }
    setBusy(true); setErr('');
    try { await onSave(f); } catch (e) { setErr(e.message || 'Nope.'); setBusy(false); }
  };

  return (
    <Sheet onClose={onClose} title={holder ? `Edit ${holder.name}` : 'New holder'}>
      <div className="grid2">
        <label>Name *
          <input value={f.name} onChange={set('name')} placeholder="Shekita James" maxLength={60} />
        </label>
        <label>House
          <select value={f.house} onChange={set('house')}>
            <option value="">None / mixed</option>
            {HOUSE_CHOICES.filter((h) => h.id).map((h) => (
              <option key={h.id} value={h.id}>{h.name}</option>
            ))}
          </select>
        </label>
      </div>
      <label>Cell — this is what gets the "a request landed in your bin" texts
        <input value={f.phone} onChange={set('phone')} inputMode="tel" placeholder="404-555-1234" maxLength={40} />
      </label>
      <label>Email
        <input value={f.email} onChange={set('email')} inputMode="email" maxLength={120} />
      </label>
      <label>Their student (name and grade)
        <input value={f.student} onChange={set('student')} placeholder="Cayenne · 7th" maxLength={80} />
      </label>
      <label>Note
        <input value={f.note} onChange={set('note')} placeholder="Texts beat calls" maxLength={200} />
      </label>
      {err && <p className="err">{err}</p>}
      <button className="btn flame wide" disabled={busy} onClick={save}>
        {busy ? 'Saving…' : holder ? 'Save changes' : 'Create holder'}
      </button>
      {holder && (
        <p className="fine">
          Handing their bins to someone else? Make the new person a holder, then
          edit each bin to point at them — the bins and their history stay put.
        </p>
      )}
    </Sheet>
  );
}

function AdminSettings({ pass, act, msg, settings, notifications }) {
  return (
    <AdminPage title="Settings" msg={msg}>
      <div className="card">
        <h3>Handoff options</h3>
        <p className="fine">
          RCA is staying hands-off, so the front desk is switched off — carline and
          student-to-student carry the handoffs. Flip this on if the school ever says yes.
        </p>
        <label className="check">
          <input
            type="checkbox"
            checked={settings?.front_desk_enabled === 'true'}
            onChange={(e) =>
              act(() => db.adminSetting(pass, 'front_desk_enabled', e.target.checked ? 'true' : 'false'))}
          />
          <span>Offer “RCA front desk” as a handoff choice</span>
        </label>
      </div>
      <AdminItemTypes pass={pass} act={act} />
      <AdminNotifications notifications={notifications} />
    </AdminPage>
  );
}

// A bin now just needs a code, a name, who carries it, and what it mostly
// holds. The person's phone and schedule live on the holder record.
function BinSheet({ bin, holders, defaultHolderId, onSave, onClose }) {
  const [f, setF] = useState({
    code: bin?.code || '',
    name: bin?.name || '',
    holderId: bin?.holder_id || defaultHolderId || '',
    focus: bin?.focus || '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const save = async () => {
    if (!bin && !f.name.trim()) { setErr('A bin needs a name.'); return; }
    setBusy(true); setErr('');
    try { await onSave({ ...f, code: f.code.trim().toUpperCase() }); }
    catch (e) { setErr(e.message || "That didn't save — try again."); setBusy(false); }
  };

  return (
    <Sheet onClose={onClose} title={bin ? `Edit ${bin.code}` : 'New bin'}>
      <div className="grid2">
        <label>Code {bin ? '(fixed — it’s on the QR)' : '(blank = next in their house)'}
          <input value={f.code} onChange={set('code')} placeholder="AMI-2" maxLength={20} disabled={!!bin} />
        </label>
        <label>Bin name *
          <input value={f.name} onChange={set('name')} placeholder="Shekita's Shirt Bin" maxLength={60} />
        </label>
      </div>
      <label>Who carries it?
        <select value={f.holderId} onChange={set('holderId')}>
          <option value="">— pick a holder —</option>
          {(holders || []).filter((h) => h.active !== false).map((h) => (
            <option key={h.id} value={h.id}>{h.name}</option>
          ))}
        </select>
      </label>
      <label>What's mostly in it? (optional)
        <input value={f.focus} onChange={set('focus')} placeholder="Shirts · Pants · Everything" maxLength={40} />
      </label>
      {err && <p className="err">{err}</p>}
      <button className="btn flame wide" disabled={busy} onClick={save}>
        {busy ? 'Saving…' : bin ? 'Save changes' : 'Create bin'}
      </button>
      <p className="fine">
        Moving a bin to a different adult? Change the holder here — the QR label and
        everything logged in this bin stay exactly as they are.
      </p>
    </Sheet>
  );
}

// Item types — hidden ones keep their history but leave the dropdowns.
// Bring one back (or add something new) without touching code.
function AdminItemTypes({ pass, act }) {
  const [adding, setAdding] = useState(false);
  const [nf, setNf] = useState({ id: '', label: '', housed: false, sizeSet: 'tops' });
  const types = allItemTypes();

  return (
    <div className="card">
      <h3>Item types</h3>
      <p className="fine">
        What parents can pick from. Hiding a type keeps every bit of its history —
        it just leaves the dropdowns until you bring it back.
      </p>
      <ul className="bin-admin">
        {types.map((t) => (
          <li key={t.id} className={t.hidden ? 'retired' : ''}>
            <div className="bin-admin-main">
              <b>{t.label}</b>
              <span>
                {SIZE_SET_LABEL[t.size_set || 'tops']} sizes
                {' · '}{t.housed ? 'house-colored' : 'any house'}
                {t.hidden ? ' · hidden' : ''}
              </span>
            </div>
            <div className="bin-admin-actions">
              <button className="linkish" onClick={() =>
                act(() => db.adminItemType(pass, t.id, { hidden: !t.hidden }))}>
                {t.hidden ? 'show' : 'hide'}
              </button>
              <button className="linkish" onClick={() => {
                const label = prompt('Label', t.label);
                if (label && label.trim()) act(() => db.adminItemType(pass, t.id, { label: label.trim() }));
              }}>rename</button>
            </div>
          </li>
        ))}
      </ul>
      {adding ? (
        <>
          <div className="grid3">
            <label>Id (short, lowercase) <input value={nf.id} placeholder="belt"
              onChange={(e) => setNf({ ...nf, id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })} /></label>
            <label>Label <input value={nf.label} placeholder="Belt"
              onChange={(e) => setNf({ ...nf, label: e.target.value })} /></label>
            <label>House-colored?
              <select value={nf.housed ? 'y' : 'n'} onChange={(e) => setNf({ ...nf, housed: e.target.value === 'y' })}>
                <option value="n">No — any house</option>
                <option value="y">Yes</option>
              </select>
            </label>
          </div>
          <label>Which sizes does it use?
            <select value={nf.sizeSet} onChange={(e) => setNf({ ...nf, sizeSet: e.target.value })}>
              {Object.entries(SIZE_SET_LABEL).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </label>
          <button className="btn small" onClick={() =>
            act(async () => {
              if (!nf.id || !nf.label.trim()) throw new Error('Id and label are required.');
              await db.adminItemType(pass, nf.id, {
                label: nf.label.trim(), housed: nf.housed, hidden: false,
                sort: 65, sizeSet: nf.sizeSet,
              });
              setNf({ id: '', label: '', housed: false, sizeSet: 'tops' }); setAdding(false);
            })}>Add type</button>
          <button className="linkish" onClick={() => setAdding(false)}>cancel</button>
        </>
      ) : (
        <button className="btn small ghost" onClick={() => setAdding(true)}>＋ Add a type</button>
      )}
    </div>
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
              <span>{o.contact ? prettyPhone(o.contact) : 'no contact left'} · {binName(o.bin_id)} · {fmtDay(o.created_at)}</span>
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
// ---------------------------------------------------------------------------
// What's on hand — the cupboard, by house, down to the size, and whose trunk
// it's in. The question this answers is the one that comes up on the phone:
// "does anyone have a 12 for an Amistad family, and who do I call?"
// ---------------------------------------------------------------------------
function AdminInventory({ bins, inv, reqs, setPrintBins }) {
  const [house, setHouse] = useState('all');
  const [q, setQ] = useState('');
  const [view, setView] = useState('house');

  const report = useMemo(() => stockByHouse(inv, bins, reqs), [inv, bins, reqs]);
  const shown = house === 'all' ? report : report.filter((h) => h.house === house);

  const hit = (...parts) =>
    !q.trim() || parts.filter(Boolean).join(' ').toLowerCase().includes(q.trim().toLowerCase());

  const onHand = report.reduce((n, h) => n + h.onHand, 0);
  const promised = report.reduce((n, h) => n + h.promised, 0);
  const shortages = report.reduce((n, h) => n + h.shortages.length, 0);

  // The same stock, turned around: one card per bin, for when you know who you
  // want to call and need to know what they're carrying.
  const perBin = useMemo(() => {
    const map = new Map();
    for (const h of report) {
      for (const t of h.types) {
        for (const s of t.sizes) {
          for (const w of s.where) {
            if (!map.has(w.binId)) map.set(w.binId, { ...w, qty: 0, lines: [] });
            const b = map.get(w.binId);
            b.qty += w.qty;
            b.lines.push({ itemType: t.itemType, size: s.size, house: h.house, qty: w.qty });
          }
        }
      }
    }
    return [...map.values()].sort((a, b) => b.qty - a.qty || a.code.localeCompare(b.code));
  }, [report]);

  return (
    <AdminPage title="What's on hand">
      <div className="report-stats">
        <div><b>{onHand}</b><span>items on hand</span></div>
        <div><b>{onHand - promised}</b><span>free to give out</span></div>
        <div><b>{promised}</b><span>already spoken for</span></div>
        {shortages > 0 && <div><b>{shortages}</b><span>sizes nobody has</span></div>}
      </div>

      <div className="mode-tabs">
        {[['house', 'By house'], ['bin', 'By bin']].map(([k, label]) => (
          <button key={k} className={`mode ${view === k ? 'on' : ''}`} onClick={() => setView(k)}>
            {label}
          </button>
        ))}
      </div>

      <input
        className="search" value={q} onChange={(e) => setQ(e.target.value)}
        placeholder="Find a size, an item, a bin or a name"
      />

      {view === 'house' && (
        <>
          <div className="mode-tabs">
            {/* Houses in their usual order, with the neutral pile last. */}
            {[['all', 'Every house'], ...HOUSES.map((h) => [h.id, h.name]), ['any', 'Any house']]
              .map(([k, label]) => (
                <button
                  key={k}
                  className={`mode ${house === (k === 'any' ? '' : k) ? 'on' : ''}`}
                  onClick={() => setHouse(k === 'any' ? '' : k)}>
                  {label}
                </button>
              ))}
          </div>

          {shown.map((h) => {
            const types = h.types
              .map((t) => ({
                ...t,
                sizes: t.sizes.filter((s) =>
                  hit(typeLabel(t.itemType), sizeLabel(s.size), ...s.where.map((w) => `${w.code} ${w.holder}`))),
              }))
              .filter((t) => t.sizes.length);
            const shorts = h.shortages.filter((s) => hit(typeLabel(s.itemType), sizeLabel(s.size)));
            if (!types.length && !shorts.length) return null;

            return (
              <div className="card" key={h.house || 'any'}>
                <div className="stock-head">
                  <HouseTag id={h.house} />
                  <span className="fine">
                    ~{h.onHand} on hand{h.promised ? ` · ${h.promised} spoken for` : ''}
                  </span>
                </div>

                {types.map((t) => (
                  <div className="stock-type" key={t.itemType}>
                    <h4>{typeLabel(t.itemType)}</h4>
                    <ul className="stock-rows">
                      {t.sizes.map((s) => (
                        <li key={s.size}>
                          <span className="stock-size">{sizeChip(s.size)}</span>
                          <span className={`stock-qty ${s.free === 0 ? 'spent' : ''}`}>
                            {s.qty}
                            {s.promised > 0 && <em>{s.free} free</em>}
                          </span>
                          <span className="stock-where">
                            {s.where.map((w) => (
                              <a key={w.binId} href={`#/bin/${w.code}`}>
                                {w.code}
                                {w.qty > 1 ? ` ×${w.qty}` : ''}
                                {w.holder ? <i> · {w.holder.split(' ')[0]}</i> : null}
                              </a>
                            ))}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}

                {shorts.length > 0 && (
                  <div className="stock-type stock-short">
                    <h4>Waiting on — nobody has these</h4>
                    <ul className="stock-rows">
                      {shorts.map((s) => (
                        <li key={`${s.itemType}|${s.size}`}>
                          <span className="stock-size">{sizeChip(s.size)}</span>
                          <span className="stock-qty">{typeLabel(s.itemType)}</span>
                          <span className="stock-where">
                            <b>{s.qty} {s.qty === 1 ? 'family' : 'families'} waiting</b>
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}

          {!shown.some((h) => h.onHand || h.shortages.length) && (
            <p className="empty">
              {q ? 'Nothing matches that.' : 'Nothing counted in yet — holders add theirs from their own page.'}
            </p>
          )}
        </>
      )}

      {view === 'bin' && (
        <>
          {perBin
            .map((b) => ({
              ...b,
              lines: b.lines.filter((l) => hit(typeLabel(l.itemType), sizeLabel(l.size), b.code, b.holder)),
            }))
            .filter((b) => b.lines.length)
            .map((b) => (
              <div className="card" key={b.binId}>
                <div className="stock-head">
                  <b>{b.code} · {b.name}</b>
                  <span className="fine">{b.holder} · ~{b.qty} items</span>
                </div>
                <ul className="stock-rows">
                  {b.lines
                    .sort((x, y) => x.itemType.localeCompare(y.itemType) || x.size.localeCompare(y.size))
                    .map((l) => (
                      <li key={`${l.itemType}|${l.size}|${l.house}`}>
                        <span className="stock-size">{sizeChip(l.size)}</span>
                        <span className="stock-qty">{l.qty}</span>
                        <span className="stock-where">
                          {typeLabel(l.itemType)} {l.house && <HouseTag id={l.house} />}
                        </span>
                      </li>
                    ))}
                </ul>
                <p className="fine">
                  <a href={`#/bin/${b.code}`}>Open the bin</a>
                  {' · '}
                  <button className="linkish" onClick={() => setPrintBins([bins.find((x) => x.id === b.binId)].filter(Boolean))}>
                    Print its label
                  </button>
                </p>
              </div>
            ))}
          {!perBin.length && <p className="empty">Nothing counted in yet.</p>}
        </>
      )}

      <p className="fine page-foot">
        Counts are approximate on purpose — bins are living things. Every add and take
        is in the movement log; open any bin for its history.
      </p>
    </AdminPage>
  );
}

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
        {avgDays && <div><b>{avgDays}d</b><span>avg request to in hand</span></div>}
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
      <p className="fine">
        <a href="#/admin/inventory">See everything on hand</a> — by house, by size, and
        which bin it's in.
      </p>
    </div>
  );
}

// The text-message outbox: what's queued, what's gone out.
function AdminNotifications({ notifications }) {
  const rows = notifications || [];
  if (!rows.length) return null;
  const pending = rows.filter((n) => n.status === 'pending').length;
  return (
    <div className="card">
      <h3>Text updates {pending > 0 ? `· ${pending} queued` : ''}</h3>
      <p className="fine">
        Texts go out the moment something happens — a request lands, a handoff is set,
        an item changes hands. Anything stuck here is retried on the hour.
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
