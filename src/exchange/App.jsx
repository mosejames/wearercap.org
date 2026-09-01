import { Fragment, useEffect, useMemo, useState } from 'react';
import {
  SITE, DONATION_STANDARD, APPROX_NOTE, FIT_HINT, sizeGroups, sizeLabel, firstSize,
  SIZE_SET_LABEL, prettyPhone, phoneDigits, sizeChip,
  houseById, houseInfo, HOUSE_CHOICES, HOUSES,
  setItemTypes, allItemTypes, visibleItemTypes, typeHoused, typesForGender, GENDERS,
  typeMaxQty, REQUEST_MAX_ITEMS, onlySize, sizeSetFor,
  typeLabel, binUrl, holderUrl, CONTACT, TEXT_FROM } from './config.js';
import * as db from './data.js';
import { byBin, totals, pickBin, drift, stockByHouse,
  sheetLines, sheetExtras, sheetDirty } from './inventory.js';
import { nextSlots, schoolMornings, slotLabel, handoffSummary, availabilityLine, myRequestsLead, WEEKDAYS } from './handoff.js';
import { socialProof, suggestedPost } from './social.js';
import { qrSvg } from './qr.js';

// A bin holds whatever a family outgrew, so a holder needs the whole list —
// but grouped, because "Khaki Pants" means a different garment depending on
// who wore it. Co-ed pieces sit in their own group: one line, one total.
const GENDER_LABEL = { girls: 'Girls', boys: 'Boys', coed: 'Either' };

function ItemPicker({ value, onChange, disabled = false }) {
  const groups = [
    ['Girls', visibleItemTypes().filter((t) => t.gender === 'girls')],
    ['Boys', visibleItemTypes().filter((t) => t.gender === 'boys')],
    ['Either', visibleItemTypes().filter((t) => (t.gender || 'coed') === 'coed')],
  ].filter(([, list]) => list.length);

  return (
    <select value={value} onChange={onChange} disabled={disabled}>
      {groups.map(([label, list]) => (
        <optgroup key={label} label={label}>
          {list.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
        </optgroup>
      ))}
    </select>
  );
}

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

// What the "it left my hands" button says. "Handed it off" is right for a
// carline meeting and wrong for a bag zipped into a backpack.
function sentLabel(r, tense = 'now', student = '') {
  if (r.handoff_mode === 'student') {
    const kid = (student || '').trim().split(' ')[0];
    return tense === 'past' ? 'sent it in' : `Sent it with ${kid || 'my student'}`;
  }
  return tense === 'past' ? 'handed off' : 'Handed it off';
}

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
// Who you're looking for. A name and a car description go a long way; a face
// goes further, which is why a holder can put one up.
function HolderCard({ bin, photo, name, spot, student, phone, children }) {
  const who = name || bin?.holder_name || '';
  const pic = photo || bin?.holder_photo || bin?.holder?.photo_url || '';
  const where = spot || bin?.carline_spot || '';
  const kid = student || bin?.holder_student || '';
  if (!who && !pic && !where) return null;

  return (
    <div className="who">
      {pic
        ? <img className="who-face" src={pic} alt={who ? `${who}` : 'Your bin holder'} />
        : <div className="who-face who-blank">{(who || '?').slice(0, 1)}</div>}
      <div className="who-text">
        {who && <b>{who}</b>}
        {where && <span>📍 {where}</span>}
        {kid && <span>Their student: {kid}</span>}
        {phone && <span><a href={`tel:${phone.replace(/\D/g, '')}`}>{phone}</a></span>}
        {children}
      </div>
    </div>
  );
}

function SizePicker({ itemType, value, onChange, placeholder, disabled = false }) {
  return (
    <select value={value} onChange={onChange} disabled={disabled}>
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

      {err && <div className="shell warn-wrap"><div className="warn">{err}</div></div>}

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
        <Home bins={bins} inv={inv} commitments={commitments} refresh={refresh} settings={settings} />
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
// Proof of life.
//
// A swap dies quietly: the tubs are full, the page looks like a form, and every
// family who lands on it assumes nothing's in there and nobody else is using
// it. So one line at a time, something true drifts up from the corner —
// somebody dropped off six polos, an Amistad family took khakis home, forty
// polos are sitting in a tub right now.
//
// One at a time, never stacked, dismissible, and it stops after the last one
// rather than looping forever and turning into wallpaper.
// ---------------------------------------------------------------------------
function ProofBubbles({ movements, inv, bins }) {
  const lines = useMemo(
    () => socialProof(movements, inv, bins, new Date(), 6),
    [movements, inv, bins]
  );
  const [i, setI] = useState(0);
  const [shown, setShown] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    if (done || !lines.length || i >= lines.length) return undefined;
    // Someone reading with reduced motion gets the words and none of the drift.
    const quick = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
    const inAt = setTimeout(() => setShown(true), i === 0 ? 1400 : 600);
    const outAt = setTimeout(() => setShown(false), (i === 0 ? 1400 : 600) + (quick ? 9000 : 6500));
    const nextAt = setTimeout(() => setI(i + 1), (i === 0 ? 1400 : 600) + (quick ? 9600 : 7100));
    return () => { clearTimeout(inAt); clearTimeout(outAt); clearTimeout(nextAt); };
  }, [i, lines.length, done]);

  if (done || !lines.length || i >= lines.length) return null;

  return (
    <div className={`proof ${shown ? 'on' : ''}`} aria-live="polite">
      <span className="proof-dot" aria-hidden="true" />
      <p>{lines[i].text}</p>
      <button className="proof-x" onClick={() => setDone(true)} aria-label="Hide these updates">×</button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Home — search everything, request an item.
// ---------------------------------------------------------------------------
function Home({ bins, inv, commitments, refresh, settings }) {
  // The movement log is already public and carries no names — it's what makes
  // the front page feel like a place things happen rather than a form.
  const [moves, setMoves] = useState([]);
  useEffect(() => {
    let live = true;
    db.listMovements(null, 40).then((m) => live && setMoves(m)).catch(() => {});
    return () => { live = false; };
  }, []);

  const [gender, setGender] = useState('');
  const [type, setType] = useState('');
  const [size, setSize] = useState('');
  const [qty, setQty] = useState(1);
  const [house, setHouse] = useState('all'); // 'all' | '' (any-house) | house id
  const [order, setOrder] = useState([]);    // up to REQUEST_MAX_ITEMS lines
  const [sheet, setSheet] = useState(false);
  const [offering, setOffering] = useState(false);

  const assigned = commitments; // already only what's promised out, no people

  // A family says what they need; the matching happens out of sight. Showing
  // bin contents here only ever raised questions — whether a count was a size,
  // whether a list was other people's requests, why the thing on screen wasn't
  // reserved for them. None of that is a parent's problem to solve.
  const requesterHouse = house === 'all' ? '' : house;
  const needsHouse = house === 'all';
  const items = typesForGender(gender);
  const cap = typeMaxQty(type);
  const full = order.length >= REQUEST_MAX_ITEMS;
  const already = order.some((l) => l.itemType === type && l.size === size);
  const ready = !!gender && !!type && !!size && !needsHouse && !full && !already;

  const addToOrder = () => {
    setOrder([...order, {
      itemType: type,
      size,
      // Polos, vests and ties belong to a house; khakis fit anyone.
      house: typeHoused(type) ? requesterHouse : '',
      requesterHouse,
      qty: Math.min(qty, cap),
    }]);
    setType(''); setSize(''); setQty(1);
  };

  const drop = (i) => setOrder(order.filter((_, n) => n !== i));

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
        {/* Who it's for comes first: a girl at RCA has two polos, two pant
            cuts, a skort and a blouse to choose between; a boy has one of
            each. Asking up front is shorter than one list of everything. */}
        <div className="mode-tabs">
          {GENDERS.map((g) => (
            <button
              key={g.id}
              className={`mode ${gender === g.id ? 'on' : ''}`}
              onClick={() => {
                setGender(g.id);
                // Keep the item only if the new list still has it — the co-ed
                // pieces survive the switch, the rest don't.
                if (type && !typesForGender(g.id).some((t) => t.id === type)) {
                  setType(''); setSize('');
                }
              }}>
              {g.label}
            </button>
          ))}
        </div>

        <div className="filters">
          <select value={house} onChange={(e) => setHouse(e.target.value)}>
            <option value="all">Choose your house</option>
            {HOUSES.map((h) => <option key={h.id} value={h.id}>{h.name}</option>)}
          </select>
          <select
            value={type}
            disabled={!gender}
            onChange={(e) => {
              const t = e.target.value;
              setType(t);
              setQty(1);
              // The tie comes one way only — don't make anyone pick from a
              // list of one. Otherwise a size from another set would mean
              // nothing for this item, so it goes.
              const lone = onlySize(t);
              if (lone) setSize(lone);
              else if (size && t && !sizeGroups(t).some((g) => g.sizes.some((x) => x.v === size))) {
                setSize('');
              }
            }}>
            <option value="">{gender ? 'Choose your item' : 'Pick a student first'}</option>
            {items.map((t) => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select>
          <SizePicker
            itemType={type} value={size} placeholder="Choose your size"
            disabled={!!onlySize(type)}
            onChange={(e) => { setSize(e.target.value); setQty(1); }}
          />
        </div>

        {/* Only worth asking when there's a choice. A student wears one vest. */}
        {cap > 1 && !!type && (
          <label className="qty-line">
            How many?
            <select value={qty} onChange={(e) => setQty(Number(e.target.value))}>
              {Array.from({ length: cap }, (_, i) => i + 1).map((n) => (
                <option key={n} value={n}>{n}</option>
              ))}
            </select>
          </label>
        )}

        <button className="btn ghost wide" disabled={!ready} onClick={addToOrder}>
          {type && size && ready ? `Add ${typeLabel(type)} to my request` : 'Add to my request'}
        </button>

        <p className="fine ask-note">
          {!gender
            ? 'Start by saying who it\u2019s for — or show everything, if you already know the item.'
            : full
              ? `That\u2019s ${REQUEST_MAX_ITEMS} — the most one request can hold, so the next family finds something too. Send it and you can always ask again.`
              : already
                ? 'That one\u2019s already on your request.'
                : needsHouse
                  ? 'Pick your house — we ask your own house\u2019s bin first.'
                  : !type || !size
                    ? 'Pick an item and a size to get started.'
                    : onlySize(type)
                      ? `${typeLabel(type)} comes one size, so there\u2019s nothing to pick.`
                      : "Not sure of the size? Ask anyway \u2014 say so in the notes and your bin holder will work it out with you."}
        </p>

        {order.length > 0 && (
          <div className="order">
            <h3>What you're asking for</h3>
            <ul className="order-list">
              {order.map((l, i) => (
                <li key={`${l.itemType}|${l.size}`}>
                  <div className="order-what">
                    <b>{typeLabel(l.itemType)}</b>
                    {l.house ? <HouseTag id={l.house} /> : null}
                    <span className="size-chip">{sizeChip(l.size)}</span>
                    {l.qty > 1 && <span className="order-qty">×{l.qty}</span>}
                  </div>
                  <button className="linkish" onClick={() => drop(i)}>remove</button>
                </li>
              ))}
            </ul>
            <button className="btn flame wide" onClick={() => setSheet(true)}>
              Send my request
            </button>
          </div>
        )}
      </section>

      {sheet && (
        <RequestSheet
          order={order}
          inv={inv}
          assigned={assigned}
          bins={bins}
          settings={settings}
          onDone={() => { setSheet(false); setOrder([]); refresh(); }}
          onClose={() => setSheet(false)}
        />
      )}
      <ProofBubbles movements={moves} inv={inv} bins={bins} />

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
function RequestSheet({ order, inv, assigned, bins, settings, onDone, onClose }) {
  const [form, setForm] = useState({ parentName: '', student: '', contact: '', note: '', share: true });
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState(null);
  const [err, setErr] = useState('');
  // Straight from "sent" into "how do you want it" — one holder at a time,
  // without leaving the page or waiting on a text that may have been filtered.
  const [pickQueue, setPickQueue] = useState([]);
  const [picked, setPicked] = useState([]);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target ? e.target.value : e });

  const submit = async () => {
    // All three are needed to finish the job, not just to open a record: the
    // holder hands the bag to a named student, and every step after this —
    // the confirmation, the handoff link, the private page — arrives by text.
    if (!form.parentName.trim()) { setErr('We need your name.'); return; }
    if (!form.student.trim()) {
      setErr("We need your student's name — that's who the bin holder is handing it to.");
      return;
    }
    if (!phoneDigits(form.contact)) {
      setErr('We need a cell number we can text — that\u2019s how you get your item.');
      return;
    }
    setBusy(true); setErr('');
    try {
      // One row per line, because each one is matched, promised and handed
      // over on its own — a polo may be waiting in your house's bin while the
      // shorts are still on the waitlist.
      const out = [];
      const holdersChosen = new Set();
      for (const line of order) {
        const houseBins = bins
          .filter((b) => !b.retired && b.holder_house === line.requesterHouse)
          .map((b) => b.id);

        // One trip beats two, and a trip is a PERSON, not a tub — Shekita may
        // keep polos in one bin and ties in another, but that's one car at one
        // window. So prefer any bin belonging to someone already answering part
        // of this request; otherwise their own house's bin, then the deepest.
        const sameHands = bins
          .filter((b) => !b.retired && holdersChosen.has(b.holder_id))
          .map((b) => b.id);
        let binId = sameHands.length
          ? pickBin(inv, assigned, line.itemType, line.size, line.house, line.qty || 1, sameHands)
          : null;
        if (!binId || !sameHands.includes(binId)) {
          binId = pickBin(
            inv, assigned, line.itemType, line.size, line.house, line.qty || 1, houseBins
          );
        }
        const holderOf = bins.find((b) => b.id === binId)?.holder_id;
        if (holderOf) holdersChosen.add(holderOf);
        out.push(await db.addRequest({ ...form, ...line, qty: line.qty || 1 }, binId));
      }
      setResults(out);
      // One pick per person holding something for them (the database moves the
      // rest of that person's items along with it).
      const seen = new Set();
      const q = [];
      for (const r of out) {
        if (!r.bin_id) continue;
        const who = bins.find((b) => b.id === r.bin_id)?.holder_id || r.bin_id;
        if (seen.has(who)) continue;
        seen.add(who);
        q.push(r);
      }
      setPickQueue(q);
    } catch (e) {
      setErr(e.message || "That didn't go through — try again.");
    } finally {
      setBusy(false);
    }
  };

  if (results && pickQueue.length) {
    const r = pickQueue[0];
    return (
      <HandoffSheet
        fresh
        req={{ ...r, contact: form.contact, student: form.student, parent_name: form.parentName }}
        bin={bins.find((b) => b.id === r.bin_id) || null}
        frontDesk={settings?.front_desk_enabled === 'true'}
        carline={settings?.carline_enabled === 'true'}
        onDone={() => { setPicked([...picked, r.id]); setPickQueue(pickQueue.slice(1)); }}
        onClose={() => setPickQueue([])}
      />
    );
  }

  if (results) {
    const ready = results.filter((r) => r.bin_id);
    const waiting = results.filter((r) => !r.bin_id);
    const allPicked = ready.length > 0 && picked.length > 0 &&
      ready.every((r) => picked.includes(r.id) ||
        picked.some((id) => {
          const p = results.find((x) => x.id === id);
          const who = (x) => bins.find((b) => b.id === x.bin_id)?.holder_id || x.bin_id;
          return p && who(p) === who(r);
        }));
    const named = (r) => {
      const bin = bins.find((b) => b.id === r.bin_id);
      return `${typeLabel(r.item_type)} · ${sizeLabel(r.size)}${bin ? ` — ${bin.name}` : ''}`;
    };

    return (
      <Sheet onClose={onDone} title="You're all set">
        {ready.length > 0 && (
          <>
            <p className="big">
              {ready.length === results.length && results.length > 1
                ? 'Both are waiting for you.'
                : ready.length > 1 ? `${ready.length} of these are waiting for you.` : 'It\u2019s waiting for you.'}
            </p>
            <ul className="plainlist">
              {ready.map((r) => <li key={r.id}>{named(r)}</li>)}
            </ul>
            {allPicked ? (
              <p>
                Handoff set. We've asked your bin holder to confirm and will text you when
                they do — and again the morning it goes in.
              </p>
            ) : (
              <p>
                Next: <a href="#/requests"><b>set up the handoff</b></a> — it comes home in a
                backpack with the bin holder's student. The link is in your text too.
              </p>
            )}
            <p className="fine">
              Our texts come from <b>{TEXT_FROM}</b>. If you don't see one in a minute, check
              your phone's filtered or unknown-senders list — saving the number stops that.
            </p>
            {new Set(
              ready.map((r) => bins.find((b) => b.id === r.bin_id)?.holder_id || r.bin_id)
            ).size > 1 && (
              <p className="fine">
                These are with two different people, so you'll pick a morning for each.
                Nothing is held back waiting on the other.
              </p>
            )}
          </>
        )}
        {waiting.length > 0 && (
          ready.length > 0 ? (
            <>
              <p>
                Still looking for{' '}
                <b>{waiting.map((r) => `${typeLabel(r.item_type)} · ${sizeLabel(r.size)}`).join(' and ')}</b>.
                Nobody has {waiting.length > 1 ? 'those' : 'that'} right now.
              </p>
              <p className="fine">
                Nothing above is waiting on it — go ahead and pick your handoff. The
                moment {waiting.length > 1 ? 'they turn' : 'one turns'} up in any bin we'll
                match {waiting.length > 1 ? 'them' : 'it'} to you and text you.
              </p>
            </>
          ) : (
            <p className="big">
              Nothing in the bins right now, so you're on the <b>waitlist</b> — the moment a
              match lands in any bin we'll match it to you and text you.
            </p>
          )
        )}
        <button className="btn flame wide" onClick={onDone}>Done</button>
      </Sheet>
    );
  }

  return (
    <Sheet onClose={onClose} title="Send my request">
      <ul className="order-list confirm">
        {order.map((l) => (
          <li key={`${l.itemType}|${l.size}`}>
            <div className="order-what">
              <b>{typeLabel(l.itemType)}</b>
              {l.house ? <HouseTag id={l.house} /> : null}
              <span className="size-chip">{sizeChip(l.size)}</span>
              {l.qty > 1 && <span className="order-qty">×{l.qty}</span>}
            </div>
          </li>
        ))}
      </ul>
      <p className="fine">
        We ask your own house's bin first whenever it has the item — that's how the
        swap has always worked.
      </p>
      <div className="grid2">
        <label>Your name *
          <input value={form.parentName} onChange={set('parentName')} placeholder="Danielle" maxLength={60} />
        </label>
        <label>Student &amp; grade *
          <input value={form.student} onChange={set('student')} placeholder="Imani, 6th" maxLength={60} />
        </label>
      </div>
      <label>Cell number *
        <input value={form.contact} onChange={set('contact')} inputMode="tel" placeholder="404-555-1234" maxLength={80} />
      </label>
      <p className="fine">
        Your confirmation and the page that keeps track of it all come by text
        from <b>{TEXT_FROM}</b> — save the number so it doesn't get filtered.
      </p>
      <label className="check sub">
        <input type="checkbox" checked={form.share}
          onChange={(e) => setForm({ ...form, share: e.target.checked })} />
        <span>
          My bin holder can text or call me about this. <em>Bin holders are RCAP parents
          who volunteer; a quick text usually beats the app when plans change.</em>
        </span>
      </label>
      <label>Anything else? (optional)
        <input value={form.note} onChange={set('note')} placeholder={FIT_HINT} maxLength={200} />
      </label>
      {err && <p className="err">{err}</p>}
      <button className="btn flame wide" disabled={busy} onClick={submit}>
        {busy ? 'Sending…' : 'Send my request'}
      </button>
      <p className="fine">
        Next you'll confirm the handoff — it comes home in a backpack with the bin
        holder's student. Free, always.
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
    if (!form.parentName.trim()) { setErr('We need your name.'); return; }
    if (!phoneDigits(form.contact)) {
      setErr('We need a cell number — it\u2019s how your bin holder arranges the pickup.');
      return;
    }
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
      <Sheet onClose={onDone} title="Thank you">
        <p className="big">
          Your offer is in{bin?.holder_name ? <> — <b>{bin.holder_name}</b> ({bin.name}) will reach
          out to arrange the pickup</> : ' — a bin holder will reach out to arrange the pickup'}.
        </p>
        <p>We just texted you a confirmation.</p>
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
      <label>Cell number * (so your bin holder can arrange the pickup)
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
                {plan && <span className="plan">🤝 {plan}{r.holder_name ? ` · with ${r.holder_name}` : ''}</span>}
                {r.status === 'scheduled' && (
                  <span className={`plan confirm-line ${r.holder_confirmed_at ? 'yes' : ''}`}>
                    {r.holder_confirmed_at
                      ? `✅ ${r.holder_name?.split(' ')[0] || 'Your bin holder'} confirmed${r.handoff_mode === 'student' ? ' — it’s coming in a backpack' : ' — they’ll be there'}`
                      : `Waiting on ${r.holder_name?.split(' ')[0] || 'your bin holder'} to confirm — we’ll text you when they do`}
                  </span>
                )}
                {r.status === 'scheduled' && r.handoff_mode !== 'student' && (
                  <HolderCard
                    name={r.holder_name} photo={r.holder_photo}
                    spot={r.holder_spot} phone={r.holder_phone}
                  >
                    {!r.family_shared && (
                      <button className="linkish who-share" onClick={async () => {
                        await db.shareContact(r.id, 'family', { access: token });
                        load();
                      }}>Share my number with {r.holder_name?.split(' ')[0] || 'them'}</button>
                    )}
                    {r.family_shared && !r.holder_phone && (
                      <span>They have your number. Theirs is theirs to share.</span>
                    )}
                  </HolderCard>
                )}
                {r.status === 'scheduled' && r.handoff_mode === 'student' && r.holder_student && (
                  <span className="plan">Coming in with {r.holder_student}</span>
                )}
              </div>
              <div className="req-side">
                <span className={`chip chip-${r.status}`}>
                  {r.status === 'scheduled' && r.holder_confirmed_at ? 'Confirmed' : STATUS_LABEL[r.status]}
                </span>
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
                  >Got it</button>
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
          carline={settings?.carline_enabled === 'true'}
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
function HandoffSheet({ req, bin, frontDesk, carline = false, onDone, onClose, fresh = false }) {
  // Carline is switched off site-wide for now (Storage Room → Settings); the
  // bin holders' kids carry the bags. A holder's own carline availability
  // still exists underneath, ready for when that changes.
  const carlineOn = carline && bin?.offers_carline !== false;
  // Student to student is the default for everyone: the bag rides in a
  // backpack and nobody has to find anybody in a carline. Carline stays on
  // offer for families who'd rather meet.
  const [mode, setMode] = useState(
    bin?.offers_student !== false ? 'student' : (carlineOn ? 'carline' : 'student')
  );
  const [pick, setPick] = useState(null);
  const [student, setStudent] = useState(req.student || '');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // What this holder is already committed to, so the list can point at the
  // morning they're already making the trip for.
  const [booked, setBooked] = useState([]);
  useEffect(() => {
    let live = true;
    if (bin?.id) db.binHandoffDays(bin.id).then((d) => live && setBooked(d)).catch(() => {});
    return () => { live = false; };
  }, [bin?.id]);

  const slots = nextSlots(bin, new Date(), 6, {
    booked,
    maxDays: bin?.max_handoff_days || bin?.holder?.max_handoff_days || 2,
  });
  const capped = slots.length > 0 && slots.every((x) => x.already);
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
        {bin?.offers_student !== false && (
          <button className={`mode ${mode === 'student' ? 'on' : ''}`} onClick={() => setMode('student')}>
            Student to student
          </button>
        )}
        {carlineOn && (
          <button className={`mode ${mode === 'carline' ? 'on' : ''}`} onClick={() => setMode('carline')}>
            Meet at carline
          </button>
        )}
        {bin?.holder?.special_arrangements && (
          <button className={`mode ${mode === 'other' ? 'on' : ''}`} onClick={() => setMode('other')}>
            Another time
          </button>
        )}
        {frontDesk && (
          <button className={`mode ${mode === 'desk' ? 'on' : ''}`} onClick={() => setMode('desk')}>
            Front desk
          </button>
        )}
      </div>

      {mode === 'carline' && (
        slots.length ? (
          <>
            <p className="fine">
              {capped
                ? `${holder} is already coming in on ${slots.length === 1 ? 'this morning' : 'these mornings'} — joining one is easiest on them.`
                : `${holder} is around on these days — tap one.`}
            </p>
            <div className="slots">
              {slots.map((s) => (
                <button
                  key={s.date + s.slot}
                  className={`slot ${pick && pick.date === s.date && pick.slot === s.slot ? 'on' : ''}`}
                  onClick={() => setPick(s)}
                >
                  {slotLabel(s)}
                  {s.already && <em>already coming in</em>}
                </button>
              ))}
            </div>
            <HolderCard bin={bin} />
          </>
        ) : (
          <p className="fine">{holder} hasn't set carline days yet — try student to student.</p>
        )
      )}

      {mode === 'student' && (
        <>
          <p className="fine">
            The easy way: {holder} sends it in with {bin?.holder_student ? <b>{bin.holder_student}</b> : 'their student'},
            who hands it to yours at school. No carline, nothing to coordinate — you'll get a
            text the morning it goes in.
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
            <p className="fine">{bin.holder.special_note}</p>
          )}
        </>
      )}

      {mode === 'desk' && (
        <p className="fine">{holder} drops it at the RCA front desk with your name on it.</p>
      )}

      {err && <p className="err">{err}</p>}
      <button className="btn flame wide" disabled={busy} onClick={save}>
        {busy ? 'Setting it up…' : mode === 'student' ? 'Send it with their student' : 'Confirm handoff'}
      </button>
      {fresh && (
        <p className="fine">
          Not sure yet? <button className="linkish" onClick={onClose}>Decide later</button> — the
          link to do this is in your text.
        </p>
      )}
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
  const [settings, setSettings] = useState({});
  useEffect(() => { db.listSettings().then(setSettings).catch(() => {}); }, []);

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
        <HolderTodo token={token} holder={holder} bins={bins} queue={queue} pickups={pickups}
          inventory={inventory} reload={load} />
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
            <AvailabilityCard bin={holder} token={token} refresh={load}
              carline={settings?.carline_enabled === 'true'} />
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
    notifyChannel: holder.notify_channel || 'sms',
    photoUrl: holder.photo_url || '',
    maxDays: holder.max_handoff_days || 2,
  });
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [uploading, setUploading] = useState(false);
  const set = (k) => (e) => setF({ ...f, [k]: e.target.value });

  const pickPhoto = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true); setMsg('');
    try {
      const url = await db.uploadHolderPhoto(token, file);
      setF((cur) => ({ ...cur, photoUrl: url }));
      await db.holderUpdateSelf(token, { photoUrl: url });
      setMsg('Photo saved.'); reload();
    } catch (err) {
      setMsg(err.message || "That photo didn't upload — try a smaller one.");
    } finally { setUploading(false); }
  };

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
      {/* A face beats a car description at 7:40 in a carline. */}
      <div className="avail-body">
        <p className="fine">
          A photo so a family knows who they're walking up to. Only families with a
          handoff booked with you ever see it.
        </p>
        <div className="who">
          {f.photoUrl
            ? <img className="who-face" src={f.photoUrl} alt="" />
            : <div className="who-face who-blank">{(holder.name || '?').slice(0, 1)}</div>}
          <div className="who-text">
            <b>{holder.name}</b>
            <label className="linkish photo-pick">
              {uploading ? 'Uploading…' : f.photoUrl ? 'Change photo' : 'Add a photo'}
              <input type="file" accept="image/*" onChange={pickPhoto} disabled={uploading} />
            </label>
          </div>
        </div>
      </div>

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
        <p className="fine">Where should we reach you?</p>
        <div className="pick-row">
          {[['sms', 'Text', 'Straight to your phone.'],
            ['email', 'Email', 'Nothing on your phone.'],
            ['both', 'Both', 'Belt and braces.']]
            .map(([v, label, blurb]) => (
              <button
                key={v}
                className={`pick ${f.notifyChannel === v ? 'on' : ''}`}
                onClick={() => setF({ ...f, notifyChannel: v })}
              >
                <b>{label}</b><span>{blurb}</span>
              </button>
            ))}
        </div>
        {f.notifyChannel !== 'sms' && !f.email.trim() && (
          <p className="err">Add an email above or we'll keep texting you.</p>
        )}
      </div>

      <div className="avail-body">
        <p className="fine">And how often?</p>
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

      <div className="avail-body">
        <p className="fine">
          Most mornings you'd drive in for a handoff in one week. Families are
          offered the mornings you're already coming for first, and once you're at
          your number, that's all they can pick — nobody has to ask you for a sixth.
        </p>
        <div className="pick-row">
          {[1, 2, 3].map((n) => (
            <button
              key={n}
              className={`pick ${Number(f.maxDays) === n ? 'on' : ''}`}
              onClick={() => setF({ ...f, maxDays: n })}
            >
              <b>{n} morning{n === 1 ? '' : 's'}</b>
              <span>{n === 1 ? 'Everything on one day' : `Up to ${n} a week`}</span>
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
      body: 'When a family requests something from your bin we’ll text you what it is, who it’s for, and the morning they picked. Tap “I’ll be there” so they know you’ve seen it (or “Change the day” if that morning doesn’t work), bag it, hand it over, and tap the button that says it’s on its way. That’s the job.',
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
              <span className="start-mark">{s.done ? '' : s.informational ? '·' : i + 1}</span>
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

// ---------------------------------------------------------------------------
// Something to paste.
//
// The way a swap dies isn't that nobody wants the clothes — it's that a tub
// gets handed to a willing parent, goes in a closet, and is never mentioned
// again. Nobody sits down to write a post about second-hand khakis, so the post
// is already written, out of what's actually in their bins today.
// ---------------------------------------------------------------------------
function SpreadTheWord({ holder, inventory }) {
  const [copied, setCopied] = useState(false);
  const post = useMemo(() => suggestedPost(holder, inventory), [holder, inventory]);
  if (!post) return null;

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(post);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div className="card spread">
      <h3>Tell your people</h3>
      <p className="fine">
        Most families still don't know this exists. One message in your house group
        chat usually clears a shelf — here's one written from what's in your bins
        right now.
      </p>
      <blockquote className="post">{post}</blockquote>
      <div className="avail-actions">
        <button className="btn small flame" onClick={copy}>
          {copied ? 'Copied' : 'Copy this post'}
        </button>
        <a className="linkish" href={`sms:?&body=${encodeURIComponent(post)}`}>
          or open it in Messages
        </a>
      </div>
    </div>
  );
}

function HolderTodo({ token, holder, bins, queue, pickups, inventory, reload }) {
  const [moving, setMoving] = useState(null);
  const binCode = (id) => bins.find((b) => b.id === id)?.code || '';

  if (!queue.length && !pickups.length) {
    return (
      <>
        <section className="shell section">
          <p className="empty">
            Nothing waiting on you. When a family requests something from one of your
            bins, it lands here and we let you know.
          </p>
        </section>
        <section className="shell section">
          <SpreadTheWord holder={holder} inventory={inventory} />
        </section>
      </>
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
                    {r.status === 'scheduled' && (
                      <span className="share-line">
                        {r.family_phone
                          ? <>Their cell: <a href={`tel:${r.family_phone.replace(/\D/g, '')}`}>{r.family_phone}</a></>
                          : 'They haven’t shared a number.'}
                        {' · '}
                        {r.holder_shared
                          ? 'They have yours.'
                          : (
                            <button className="linkish" onClick={async () => {
                              await db.shareContact(r.id, 'holder', { token });
                              reload();
                            }}>Share my number</button>
                          )}
                      </span>
                    )}
                    <span className="plan">
                      {binCode(r.bin_id)}{' · '}
                      {r.status === 'assigned' ? '⏳ waiting on them to pick a time'
                        : r.status === 'handed_off' ? `✅ ${sentLabel(r, 'past')} · ${plan} — waiting on them to tap Got it`
                        : r.holder_confirmed_at ? `✅ ${plan} — you confirmed, they know`
                        : `🤝 ${plan} — they're waiting to hear you've seen this`}
                    </span>
                  </div>
                  <div className="req-side">
                    {due && r.status === 'scheduled' &&
                      <span className={`due ${due.urgent ? 'urgent' : ''}`}>{due.label}</span>}
                    {r.status === 'scheduled' && !r.holder_confirmed_at && (
                      <button className="btn small flame"
                        onClick={async () => { await db.confirmHandoff(token, r.id); reload(); }}>
                        {r.handoff_mode === 'student' ? "I'll send it in" : "I'll be there"}
                      </button>
                    )}
                    {r.status === 'scheduled' && (
                      <button className="btn small ghost" onClick={() => setMoving(r)}>
                        {r.handoff_mode === 'student' ? "Can't do this one" : 'Change the day'}
                      </button>
                    )}
                    {r.status !== 'handed_off' && (
                      <button className={`btn small ${r.holder_confirmed_at || r.status !== 'scheduled' ? 'flame' : 'ghost'}`}
                        title="Tells the family it's on its way"
                        onClick={async () => { await db.handoffSent(r.id, holder.name); reload(); }}>
                        {sentLabel(r, 'now', holder.student)}
                      </button>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section className="shell section">
        <SpreadTheWord holder={holder} inventory={inventory} />
      </section>

      {moving && (
        <MoveHandoffSheet
          token={token} req={moving} holder={holder}
          onDone={() => { setMoving(null); reload(); }}
          onClose={() => setMoving(null)}
        />
      )}

      {pickups.length > 0 && (
        <section className="shell section">
          <h2 className="h2">Pickups to arrange 👕</h2>
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
                    Collected                   </button>
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
            label it with their name, and tap the button when it leaves your hands so they get
            a text that it's on its way.
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
                          ? `${sentLabel(r, 'past')} · ${plan} — waiting on them to tap Got it`
                          : `${plan}`}
                    </span>
                  </div>
                  <div className="req-side">
                    {due && r.status === 'scheduled' &&
                      <span className={`due ${due.urgent ? 'urgent' : ''}`}>{due.label}</span>}
                    {r.status !== 'handed_off' && (
                      <button
                        className="btn small flame"
                        title="Tells the family it's on its way"
                        onClick={async () => { await db.handoffSent(r.id, bin.holder_name); reload(); }}
                      >{sentLabel(r)}</button>
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
          <h2 className="h2">Pickups to arrange 👕</h2>
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
                    Collected                   </button>
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
function AvailabilityCard({ bin, token, refresh, carline = true }) {
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
          <b>{carline ? availabilityLine(bin) : 'Student to student — your student carries the bag'}</b>
          {carline && bin.carline_spot && <span>{bin.carline_spot}</span>}
        </div>
        {!carline && (
          <p className="fine">
            Carline meetups are switched off for now, so every handoff goes in with your
            student. Your carline days are kept for when that changes.
          </p>
        )}
        <button className="btn small" onClick={() => setOpen(true)}>Edit my availability</button>
        <p className="fine">This is your schedule — it covers every bin you hold.</p>
      </div>
    );
  }

  return (
    <div className="card avail">
      {carline && (
        <label className="check">
          <input type="checkbox" checked={f.offersCarline}
            onChange={(e) => setF({ ...f, offersCarline: e.target.checked })} />
          <span>I can hand off at carline</span>
        </label>
      )}

      {carline && f.offersCarline && (
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
        <span>I can send it in with my student</span>
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
        <span>I'll arrange another time if neither works</span>
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

// What the grid holds right now, in a form two versions can be compared by.
// The row keys are throwaway, so they're left out.
// ---------------------------------------------------------------------------
// The count sheet.
//
// This used to be one line per item, each line three dropdowns and a number:
// fine for correcting a count, miserable for seeding a bin. Fifty items across
// a dozen sizes meant tapping "another line" and working three menus, fifty
// times, on a phone, in a car.
//
// So nothing is chosen any more — it's all laid out in advance and the holder
// types over it. Pick an item, every size it comes in is already on screen at
// zero, put numbers where you have clothes. House isn't asked: a house bin's
// polos are that house's polos. Anything the grid can't draw (a size retired
// since it was logged, another house's vest that ended up in the tub) is
// appended underneath so counting a bin can never quietly drop it.
// ---------------------------------------------------------------------------

const cellKey = (t, s, h) => `${t}|${s}|${h || ''}`;

// The sizes a count sheet lays out for an item: the real ones, without the
// "Other" catch-all — you can't count a bin into a size that isn't a size.
// Anything already logged against it comes back through sheetExtras.
const countGroups = (typeId) =>
  sizeGroups(typeId).filter((g) => g.group && g.sizes.length);

// Wide enough for the whole grid at once? Below this it's one item at a time.
function useWide(px = 760) {
  const [wide, setWide] = useState(
    () => typeof window !== 'undefined' && window.matchMedia(`(min-width:${px}px)`).matches
  );
  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const mq = window.matchMedia(`(min-width:${px}px)`);
    const on = (e) => setWide(e.matches);
    mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, [px]);
  return wide;
}

// One number box. Kept tiny and dumb so a grid of a hundred of them stays
// cheap; the whole sheet is one flat object of values.
function CountBox({ value, onChange, label }) {
  return (
    <input
      type="number" inputMode="numeric" min="0" max="999"
      className={`count-box ${Number(value) > 0 ? 'has' : ''}`}
      value={value} aria-label={label} placeholder="0"
      onFocus={(e) => e.target.select()}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}

function CountSheet({ token, holder, bins, inventory, reload, onPrint }) {
  const [binId, setBinId] = useState(bins[0]?.id || '');
  const [cells, setCells] = useState({});
  const [pick, setPick] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState('');
  const [saved, setSaved] = useState(null);
  const wide = useWide();

  const types = visibleItemTypes();
  // A housed item in a house bin is that house's. Neutral kit is nobody's.
  const houseOf = (typeId) => (typeHoused(typeId) ? (holder.house || '') : '');

  // Every cell the grid can draw, plus whatever's in the bin that it can't.
  const covered = useMemo(() => {
    const out = [];
    for (const t of types) {
      for (const g of countGroups(t.id)) {
        for (const sz of g.sizes) out.push(cellKey(t.id, sz.v, houseOf(t.id)));
      }
    }
    return out;
  }, [types.map((t) => t.id).join(','), holder.house]);

  const extras = useMemo(
    () => sheetExtras(inventory, binId, covered),
    [inventory, binId, covered]
  );

  // Load the bin into the grid. Zero shows as an empty box — a hundred typed
  // zeros is noise, an empty box reads as "nothing here".
  useEffect(() => {
    const have = byBin(inventory).get(binId) || new Map();
    const next = {};
    for (const k of covered) next[k] = have.get(k)?.qty > 0 ? String(have.get(k).qty) : '';
    for (const x of extras) next[cellKey(x.itemType, x.size, x.house)] = String(x.qty);
    setCells(next);
    setMsg('');
    setPick((p) => (p && types.some((t) => t.id === p) ? p : (types[0]?.id || '')));
  }, [binId, inventory, covered]);

  const cellList = useMemo(
    () => Object.entries(cells).map(([k, qty]) => {
      const [itemType, size, house] = k.split('|');
      return { itemType, size, house, qty };
    }),
    [cells]
  );

  const dirty = sheetDirty(cellList, inventory, binId);
  const set = (k, v) => setCells((c) => ({ ...c, [k]: v.replace(/[^0-9]/g, '').slice(0, 3) }));
  const bump = (k, by) =>
    setCells((c) => ({ ...c, [k]: String(Math.max(0, (Number(c[k]) || 0) + by)) }));

  // Counting a bin is the one screen someone walks away from mid-task.
  useEffect(() => {
    if (!dirty) return undefined;
    const warn = (e) => { e.preventDefault(); e.returnValue = ''; };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const totalFor = (typeId) => cellList
    .filter((c) => c.itemType === typeId)
    .reduce((n, c) => n + (Number(c.qty) || 0), 0);

  const save = async () => {
    setBusy(true); setMsg('');
    try {
      const lines = sheetLines(cellList, inventory, binId);
      const changed = await db.setHolderInventory(token, lines, holder.name);
      const stocked = cellList.filter((c) => (Number(c.qty) || 0) > 0);
      setSaved({
        changed,
        total: stocked.reduce((n, c) => n + Number(c.qty), 0),
        kinds: stocked.length,
        code: bins.find((b) => b.id === binId)?.code || '',
      });
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
  const grand = cellList.reduce((n, c) => n + (Number(c.qty) || 0), 0);

  // Laptop: items across, sizes down — one table per size set, because a
  // girls' polo and a boys' short don't share a scale and never should.
  const sets = [];
  for (const t of types) {
    const setId = sizeSetFor(t.id);
    const hit = sets.find((x) => x.id === setId);
    if (hit) hit.types.push(t);
    else sets.push({ id: setId, types: [t] });
  }

  return (
    <section className="shell section">
      <h2 className="h2">My bins</h2>
      <p className="sub">
        Type what's actually in the bin — rough is fine, it's a bin. Every size is
        already here; put a number where you have clothes and leave the rest blank.
      </p>

      <BinBar token={token} bins={bins} binId={binId} setBinId={setBinId} reload={reload} />

      {wide ? (
        sets.map((st) => (
          <div className="count-set" key={st.id}>
            <h3 className="count-set-h">{SIZE_SET_LABEL[st.id] || 'Items'}</h3>
            <div className="table-wrap">
              <table className="count-table">
                <thead>
                  <tr>
                    <th className="sz">Size</th>
                    {st.types.map((t) => (
                      <th key={t.id}>
                        {t.label}
                        {totalFor(t.id) > 0 && <em>{totalFor(t.id)}</em>}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {countGroups(st.types[0].id).map((g) => (
                    <Fragment key={g.group}>
                      <tr className="grp"><th colSpan={st.types.length + 1}>{g.group}</th></tr>
                      {g.sizes.map((sz) => (
                        <tr key={sz.v}>
                          <th className="sz">{sz.label}</th>
                          {st.types.map((t) => {
                            const k = cellKey(t.id, sz.v, houseOf(t.id));
                            return (
                              <td key={t.id}>
                                <CountBox value={cells[k] ?? ''} onChange={(v) => set(k, v)}
                                  label={`${t.label} ${sz.label}`} />
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      ) : (
        <>
          <div className="count-chips">
            {types.map((t) => (
              <button key={t.id} className={`count-chip ${pick === t.id ? 'on' : ''}`}
                onClick={() => setPick(t.id)}>
                {t.label}
                {totalFor(t.id) > 0 && <em>{totalFor(t.id)}</em>}
              </button>
            ))}
          </div>

          {countGroups(pick).map((g) => (
            <div className="count-group" key={g.group}>
              <h4 className="count-group-h">{g.group}</h4>
              <ul className="count-rows">
                {g.sizes.map((sz) => {
                  const k = cellKey(pick, sz.v, houseOf(pick));
                  return (
                    <li key={sz.v}>
                      <span className="sz">{sz.label}</span>
                      <div className="count-qty">
                        <button className="step" onClick={() => bump(k, -1)} aria-label="one fewer">−</button>
                        <CountBox value={cells[k] ?? ''} onChange={(v) => set(k, v)}
                          label={sz.label} />
                        <button className="step" onClick={() => bump(k, 1)} aria-label="one more">+</button>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </>
      )}

      {extras.length > 0 && (
        <details className="card fold count-extras">
          <summary>
            Odds and ends in this bin
            <span>{extras.length} line{extras.length === 1 ? '' : 's'} the grid doesn't cover</span>
          </summary>
          <p className="fine">
            An older size, or something from another house that ended up in your tub.
            Counted the same; zero one out to move it off the sheet.
          </p>
          <ul className="count-rows">
            {extras.map((x) => {
              const k = cellKey(x.itemType, x.size, x.house);
              return (
                <li key={k}>
                  <span className="sz">
                    {typeLabel(x.itemType)} · {sizeLabel(x.size)}
                    {x.house && x.house !== holder.house && <HouseTag id={x.house} />}
                  </span>
                  <div className="count-qty">
                    <button className="step" onClick={() => bump(k, -1)} aria-label="one fewer">−</button>
                    <CountBox value={cells[k] ?? ''} onChange={(v) => set(k, v)} label={x.size} />
                    <button className="step" onClick={() => bump(k, 1)} aria-label="one more">+</button>
                  </div>
                </li>
              );
            })}
          </ul>
        </details>
      )}

      {msg && <p className="err">{msg}</p>}
      <div className="count-save">
        <button className="btn flame wide" disabled={busy || !dirty} onClick={save}>
          {busy ? 'Saving…' : dirty ? `Save ${bin ? bin.code : ''} counts` : 'Everything here is saved'}
        </button>
        <p className={`fine save-state ${dirty ? 'unsaved' : ''}`}>
          {dirty
            ? 'You have changes that aren’t saved yet.'
            : `About ${grand} item${grand === 1 ? '' : 's'} counted in ${bin ? bin.code : 'this bin'}.`}
        </p>
      </div>

      <p className="fine count-foot">
        Every change is logged, so the history still shows what moved and when.
        {' '}<button className="linkish" onClick={onPrint}>Print my QR labels</button>
      </p>

      {saved && (
        <Sheet onClose={() => setSaved(null)} title="Thank you">
          {saved.changed ? (
            <>
              <p className="big">
                <b>{saved.code}</b> is up to date — {saved.changed} line
                {saved.changed === 1 ? '' : 's'} changed.
              </p>
              <p>
                That bin now holds about <b>{saved.total}</b> item
                {saved.total === 1 ? '' : 's'} across {saved.kinds} size
                {saved.kinds === 1 ? '' : 's'}. Families searching for those sizes
                can find them from this minute on.
              </p>
            </>
          ) : (
            <p className="big">
              Nothing needed changing — <b>{saved.code}</b> already matched what you
              typed. Saved anyway, no harm done.
            </p>
          )}
          <p className="fine">
            Counting is the whole job, and it's the part nobody sees. Thank you for
            keeping it honest.
          </p>
          <button className="btn flame wide" onClick={() => setSaved(null)}>Done</button>
        </Sheet>
      )}
    </section>
  );
}

// "Change the day." A doctor's appointment, a trip, a morning that got away
// from you — the holder moves it or hands it back, and the family hears about
// it either way rather than standing in a carline wondering. Any school
// morning is fair game here: the holder's standing days are what FAMILIES
// pick from, but the holder themselves shouldn't have to rewrite their
// availability to make one Wednesday work.
function MoveHandoffSheet({ token, req, holder, onDone, onClose }) {
  const student = req.handoff_mode === 'student';
  const [choice, setChoice] = useState(student ? 'release' : 'move');   // 'move' | 'release'
  const [pick, setPick] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState('');

  // Mornings they're already coming in for someone else, so a move can land
  // on a trip they're making anyway.
  const [booked, setBooked] = useState([]);
  useEffect(() => {
    let live = true;
    if (req.bin_id) db.binHandoffDays(req.bin_id).then((d) => live && setBooked(d)).catch(() => {});
    return () => { live = false; };
  }, [req.bin_id]);

  const mornings = schoolMornings(holder, new Date(), 15, { booked })
    .filter((s) => s.date !== req.handoff_date);

  const save = async () => {
    if (choice === 'move' && !pick) { setErr('Pick the morning that does work.'); return; }
    setBusy(true); setErr('');
    try {
      await db.rescheduleHandoff(token, req.id, choice === 'move' ? pick.date : null,
        choice === 'move' ? pick.slot : 'am', note);
      onDone();
    } catch (e) {
      setErr(e.message || "That didn't go through — try again.");
      setBusy(false);
    }
  };

  return (
    <Sheet onClose={onClose} title={student ? "Can't do this one" : 'Change the day'}>
      <p className="fine">
        {typeLabel(req.item_type)} · {sizeLabel(req.size)} for {req.parent_name},
        currently {handoffSummary(req).toLowerCase()}. Their item stays held for them
        either way — this is only about the morning.
      </p>

      {!student && (
        <div className="mode-tabs">
          {[['move', 'Pick a different morning'], ['release', 'Let them pick again']].map(([k, label]) => (
            <button key={k} className={`mode ${choice === k ? 'on' : ''}`} onClick={() => setChoice(k)}>
              {label}
            </button>
          ))}
        </div>
      )}

      {choice === 'move' ? (
        <>
          <p className="fine">
            Any school morning works here — your usual days are marked, but a one-off is fine.
            Moving it counts as confirming: they'll be told you'll be there.
          </p>
          <div className="slots mornings">
            {mornings.map((s) => (
              <button
                key={s.date}
                className={`slot ${pick && pick.date === s.date ? 'on' : ''} ${s.standing ? '' : 'off-day'}`}
                onClick={() => setPick(s)}
              >
                {slotLabel(s)}
                {s.already ? <em>already coming in</em> : s.standing ? <em>one of your days</em> : null}
              </button>
            ))}
          </div>
        </>
      ) : (
        <p className="fine">
          We'll text them that {student ? 'this one' : 'the morning'} didn't work and ask them
          to pick again from your days. Nothing is cancelled.
        </p>
      )}

      <label>Want to say why? (optional — they'll see this)
        <input value={note} onChange={(e) => setNote(e.target.value)} maxLength={140}
          placeholder="Out of town that day — sorry!" />
      </label>

      {err && <p className="err">{err}</p>}
      <button className="btn flame wide" disabled={busy} onClick={save}>
        {busy ? 'Sending…' : choice === 'move' ? 'Move it and tell them' : 'Hand it back to them'}
      </button>
    </Sheet>
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
          <ItemPicker
            value={cur.itemType}
            onChange={(e) => {
              const itemType = e.target.value;
              setCur({
                ...cur, itemType,
                size: firstSize(itemType),
                house: typeHoused(itemType) ? (cur.house || bin.holder_house || '') : '',
              });
            }}
          />
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
// A card that folds, and remembers whether you left it open.
//
// The Storage Room is read on a phone as often as a laptop, and every page
// used to be everything at once: the home screen alone ran nav cards, overdue
// handoffs, pickups, the full by-house report and the text log down one
// scroll. Nothing was too wide — it was just endless. So anything that's
// reference rather than today's work folds shut behind a headline carrying
// the one number worth glancing at, and a shut fold still tells you something.
function Fold({ id, title, note, warn = false, open = false, force = null, children }) {
  const key = `ue.fold.${id}`;
  const [on, setOn] = useState(() => {
    if (force !== null) return force;
    try {
      const v = sessionStorage.getItem(key);
      if (v !== null) return v === '1';
    } catch { /* private mode: fall through to the default */ }
    return open;
  });
  // A search that matches inside a shut fold has to open it, or the result is
  // invisible and the search looks broken.
  useEffect(() => { if (force !== null) setOn(force); }, [force]);

  const toggle = (e) => {
    const v = e.currentTarget.open;
    setOn(v);
    try { sessionStorage.setItem(key, v ? '1' : '0'); } catch { /* nothing to do */ }
  };

  return (
    <details className={`card fold ${warn ? 'warn-card' : ''}`} open={on} onToggle={toggle}>
      <summary>
        <span className="fold-title">{title}</span>
        {note && <span className="fold-note">{note}</span>}
      </summary>
      <div className="fold-body">{children}</div>
    </details>
  );
}

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
          const live = ["open","assigned","scheduled","handed_off"].includes(r.status);
          return (
            <li
              key={r.id}
              className={`req ${due?.overdue ? 'overdue' : ''} ${live ? 'tappable' : ''}`}
              onClick={live ? () => setEditing(r) : undefined}
            >
              <div className="req-main">
                <b>{typeLabel(r.item_type)} · {sizeLabel(r.size)}{r.qty > 1 ? ` ×${r.qty}` : ''} <HouseTag id={r.house} /></b>
                <span>
                  {r.parent_name}{r.student ? ` · ${r.student}` : ''}
                  {r.contact ? ` · ${prettyPhone(r.contact)}` : ' · no contact'}
                </span>
                <span className="plan">
                  {bin ? `${bin.code} · ${bin.holder_name || 'no holder'}` : 'no bin yet'}
                  {handoffSummary(r) ? ` · ${handoffSummary(r)}` : ''}
                  {` · asked ${fmtDay(r.created_at)}`}
                </span>
              </div>
              <div className="req-side">
                <span className={`chip chip-${r.status}`}>{STATUS_LABEL[r.status]}</span>
                {due && <span className={`due ${due.urgent ? 'urgent' : ''}`}>{due.label}</span>}
                {live && <button className="btn small">Edit</button>}
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
          <h3>{noPhone.length} holder{noPhone.length > 1 ? 's' : ''} with no phone</h3>
          <p className="fine">
            No number means they never hear that a request landed in their bin —
            {' '}{noPhone.map((h) => h.name).join(', ')}. Tap Edit on their card to add it.
          </p>
        </div>
      )}

      {groups.map(({ house, people }) => {
        const tubs = people.reduce((n, h) => n + binsOf(h.id).filter((b) => !b.retired).length, 0);
        const gap = people.some((h) => h.active !== false && !(h.phone || '').trim());
        return (
        <Fold
          key={house.id || 'none'}
          id={`bins.${house.id || 'none'}`}
          title={house.name}
          note={`${people.length} holder${people.length > 1 ? 's' : ''} · ${tubs} bin${tubs === 1 ? '' : 's'}${gap ? ' · no phone' : ''}`}
          warn={gap}
          open={gap}
        >

      {people.map((h) => {
        const mine = binsOf(h.id);
        return (
          <div className={`card holder-card ${h.active === false ? 'retired' : ''}`} key={h.id}>
            <div className="holder-head">
              <div>
                <b>{h.name}</b>
                <span className={h.phone ? '' : 'missing'}>
                  {h.phone ? prettyPhone(h.phone) : 'no phone — they get no texts'}
                </span>
                <span className={h.email ? '' : 'missing'}>
                  {h.email || 'no email on file'}
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
        </Fold>
        );
      })}

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
          Print every QR label
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
          RCA is staying hands-off, so the front desk is switched off — student-to-student
          carries the handoffs. Flip this on if the school ever says yes.
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
        <label className="check">
          <input
            type="checkbox"
            checked={settings?.carline_enabled === 'true'}
            onChange={(e) =>
              act(() => db.adminSetting(pass, 'carline_enabled', e.target.checked ? 'true' : 'false'))}
          />
          <span>Offer “Meet at carline” as a handoff choice</span>
        </label>
        <p className="fine">
          Off for now: the bin holders' students carry every bag. Holders' carline days are
          kept underneath, so flipping this on brings them straight back.
        </p>
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
  const [nf, setNf] = useState({ id: '', label: '', housed: false, sizeSet: 'tops', gender: 'coed' });
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
                {GENDER_LABEL[t.gender || 'coed']}
                {' · '}{SIZE_SET_LABEL[t.size_set || 'tops']} sizes
                {' · '}{t.housed ? 'house-colored' : 'any house'}
                {' · '}max {t.max_qty || 1} per request
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
          <label>Who wears it?
            <select value={nf.gender} onChange={(e) => setNf({ ...nf, gender: e.target.value })}>
              <option value="coed">Either — one shared total</option>
              <option value="girls">Girls</option>
              <option value="boys">Boys</option>
            </select>
          </label>
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
                sort: 65, sizeSet: nf.sizeSet, gender: nf.gender,
              });
              setNf({ id: '', label: '', housed: false, sizeSet: 'tops', gender: 'coed' });
              setAdding(false);
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
  const needing = live.filter((o) => o.status === 'open').length;
  return (
    <Fold
      id="offers" title="Donation pickups"
      note={needing ? `${needing} needs a call` : `${live.length} scheduled`}
      open={needing > 0}
    >
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
    </Fold>
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
              <Fold
                key={h.house || 'any'}
                id={`stock.${h.house || 'any'}`}
                title={houseInfo(h.house).name}
                note={`~${h.onHand} on hand${h.promised ? ` · ${h.promised} spoken for` : ''}${shorts.length ? ` · ${shorts.length} nobody has` : ''}`}
                open={shown.length === 1}
                force={q.trim() ? true : null}
              >
                {types.map((t) => (
                  <div className="stock-type" key={t.itemType}>
                    <h4>{typeLabel(t.itemType)} <em>{t.sizes.reduce((n, x) => n + x.qty, 0)}</em></h4>
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
              </Fold>
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
              <Fold
                key={b.binId} id={`stock.bin.${b.code}`}
                title={`${b.code} · ${b.name}`}
                note={`${b.holder ? `${b.holder.split(' ')[0]} · ` : ''}~${b.qty} items`}
                force={q.trim() ? true : null}
              >
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
              </Fold>
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
    <Fold
      id="reports" title="Reports"
      note={`${onHand} on hand · ${fulfilled.length} rehomed`}
    >
      <div className="report-stats">
        <div><b>{onHand}</b><span>items on hand</span></div>
        <div><b>{fulfilled.length}</b><span>uniforms rehomed</span></div>
        <div><b>{waitlist.length}</b><span>on the waitlist</span></div>
        {avgDays && <div><b>{avgDays}d</b><span>avg request to in hand</span></div>}
      </div>
      {rows.length > 0 && (
        <div className="table-wrap">
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
        </div>
      )}
      <p className="fine">
        <a href="#/admin/inventory">See everything on hand</a> — by house, by size, and
        which bin it's in.
      </p>
    </Fold>
  );
}

// The text-message outbox: what's queued, what's gone out.
//
// Folded shut by default. This is a delivery log — you want it when something
// hasn't arrived and never otherwise, and left open it buries the two screens
// it sits on under a wall of message bodies. The headline carries the only
// thing worth glancing at: whether anything is stuck.
function AdminNotifications({ notifications }) {
  const rows = notifications || [];
  if (!rows.length) return null;
  const pending = rows.filter((n) => n.status === 'pending').length;
  const failed = rows.filter((n) => n.status === 'failed').length;
  const shown = rows.slice(0, 30);
  // Every body opens "RCAP Uniform Exchange (AMI-1):" and closes with a link,
  // so at 80 characters every line in the log read identically. Strip the
  // boilerplate and the message itself fits.
  const gist = (body = '') => {
    const t = body
      .replace(/^RCAP Uniform Exchange\s*(\(([^)]*)\))?:\s*/, (_, __, code) => (code ? `${code} · ` : ''))
      .replace(/\s*(Your bin page|Open your page|Your page):.*$/s, '')
      .replace(/\s*https?:\/\/\S+/g, '')
      .trim();
    return t.length > 96 ? `${t.slice(0, 96)}…` : t;
  };
  return (
    <details className="card fold">
      <summary>
        <span className="fold-title">Text updates</span>
        <span className="fold-note">
          {pending > 0 ? `${pending} queued` : failed > 0 ? `${failed} stuck` : `${rows.length} sent`}
        </span>
      </summary>
      <div className="fold-body">
        <p className="fine">
          Texts go out the moment something happens — a request lands, a handoff is set,
          an item changes hands. Anything stuck here is retried on the hour.
        </p>
        <ul className="activity">
          {shown.map((n) => (
            <li key={n.id}>
              <span className={`chip ${n.status === 'sent' ? 'chip-fulfilled' : n.status === 'pending' ? 'chip-open' : n.status === 'failed' ? 'chip-failed' : 'chip-canceled'}`}>{n.status}</span>
              <span className="notif-body">{gist(n.body)}</span>
              <time>{fmtDay(n.created_at)}</time>
            </li>
          ))}
        </ul>
        {rows.length > shown.length && (
          <p className="fine">Showing the most recent {shown.length} of {rows.length}.</p>
        )}
      </div>
    </details>
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
          <button className="x" onClick={onClose} aria-label="Close"></button>
        </div>
        {children}
      </div>
    </div>
  );
}
