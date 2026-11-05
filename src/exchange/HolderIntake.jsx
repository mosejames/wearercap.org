import { useState } from 'react';
import * as db from './data.js';
import { visibleItemTypes, sizeGroups, typeHoused, typeLabel, HOUSE_CHOICES } from './config.js';
import { binItemTypes } from './bins.js';

const fresh = () => ({ key: crypto.randomUUID(), qty: 1, itemType: '', size: '', house: '',
  parentName: '', contact: '', student: '', note: '', requesterHouse: '', binId: '',
  coordination: 'holder', pickupNote: '', deduct: false, sendText: false });

function HouseChoice({ value, onChange, label = 'House (optional)' }) {
  return <label>{label}<select value={value} onChange={onChange}>
    <option value="">Choose a house</option>
    {HOUSE_CHOICES.filter(h => h.id).map(h => <option key={h.id} value={h.id}>{h.name}</option>)}
  </select></label>;
}

export default function HolderIntake({ token, holder, bins, reload }) {
  const [mode, setMode] = useState('giveaway');
  const [form, setForm] = useState(fresh);
  const [details, setDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const set = key => e => setForm(f => ({ ...f, [key]: e.target.value }));
  const check = key => e => setForm(f => ({ ...f, [key]: e.target.checked }));
  const live = bins.filter(b => !b.retired);
  const selectedBin = live.find(b => b.id === form.binId);
  const types = mode === 'request' ? visibleItemTypes() : selectedBin && form.deduct
    ? binItemTypes(selectedBin, visibleItemTypes()) : visibleItemTypes();
  const switchMode = next => { setMode(next); setForm(fresh()); setDetails(false); setMessage(''); setError(''); };
  const save = async e => {
    e.preventDefault(); if (busy) return;
    setBusy(true); setError('');
    try {
      const result = await db.holderAction(token, mode, { ...form,
        qty: Number(form.qty), house: typeHoused(form.itemType) ? form.house : '',
        binId: mode === 'giveaway' && !form.deduct ? '' : form.binId,
        requesterHouse: form.requesterHouse || holder.house || '',
      });
      setMessage(mode === 'giveaway' ? `Recorded ${form.qty} item${Number(form.qty) === 1 ? '' : 's'}. Ready for the next giveaway.`
        : result.status === 'open' ? 'Request saved on the waitlist. You can find it in To do.' : 'Request saved. You can find it in To do.');
      // A new save key and an unchecked SMS choice belong to each new entry.
      setForm(fresh()); setDetails(false); reload();
    } catch (e) { setError(e.message || 'Could not save. Please try again.'); }
    finally { setBusy(false); }
  };
  return <section className="shell section holder-intake">
    <h2 className="h2">Keep uniforms moving</h2>
    <p className="sub">Record a handoff at the table, or help a family request what they need.</p>
    <div className="mode-tabs" aria-label="Intake type">
      {[['giveaway', 'Record a giveaway'], ['request', 'Request for a family']].map(([id, label]) =>
        <button key={id} className={`mode ${mode === id ? 'on' : ''}`} aria-pressed={mode === id}
          disabled={busy} onClick={() => switchMode(id)}>{label}</button>)}
    </div>
    {message && <p role="status" className="intake-success">{message}</p>}
    <form onSubmit={save} className="intake-form">
      <fieldset disabled={busy}>
        <legend>{mode === 'giveaway' ? 'What went to a new home?' : 'What does the family need?'}</legend>
        <label>Number of items<input type="number" min="1" max={mode === 'request' ? 5 : 99} required
          inputMode="numeric" value={form.qty} onChange={set('qty')} /></label>
        {mode === 'giveaway' && <>
          <label className="intake-check"><input type="checkbox" checked={details} onChange={e => {
            setDetails(e.target.checked); if (!e.target.checked) setForm(f => ({ ...f, itemType: '', size: '', house: '', binId: '', deduct: false }));
          }} />Add item details (optional)</label>
          <p className="fine">A quick count contributes to impact totals. It does not change a bin's inventory.</p>
        </>}
        {(mode === 'request' || details) && <>
          <label>Item{mode === 'giveaway' ? ' (optional)' : ' *'}<select value={form.itemType} required={mode === 'request'} onChange={e =>
            setForm(f => ({ ...f, itemType: e.target.value, size: '', house: '' }))}>
            <option value="">Choose an item</option>{types.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
          </select></label>
          <label>Size{mode === 'giveaway' ? ' (optional)' : ' *'}<select value={form.size} required={mode === 'request'} onChange={set('size')}>
            <option value="">Choose a size</option>{sizeGroups(form.itemType).map((g, i) => <optgroup label={g.group || 'Sizes'} key={i}>
              {g.sizes.map(s => <option key={s.v} value={s.v}>{s.label || s.v}</option>)}
            </optgroup>)}
          </select></label>
          {typeHoused(form.itemType) && <HouseChoice label={mode === 'request' || form.deduct ? 'Item house *' : 'Item house (optional)'} value={form.house} onChange={set('house')} />}
          {mode === 'giveaway' && <label className="intake-check"><input type="checkbox" checked={form.deduct} onChange={check('deduct')} />Deduct these items from my bin</label>}
          {(mode === 'request' || form.deduct) && <label>{mode === 'request' ? 'Stock to reserve' : 'Bin *'}<select value={form.binId} onChange={set('binId')} required={form.deduct}>
            <option value="">{mode === 'request' ? 'No stock yet. Put on waitlist' : 'Choose a bin'}</option>
            {live.filter(b => !form.itemType || binItemTypes(b, visibleItemTypes()).some(t => t.id === form.itemType))
              .map(b => <option key={b.id} value={b.id}>{b.name} ({b.code})</option>)}
          </select></label>}
        </>}
        <details open={mode === 'request' || undefined}>
          <summary>{mode === 'request' ? 'Family details' : 'Recipient and text (optional)'}</summary>
          <label>Recipient name{mode === 'request' ? ' *' : ' (optional)'}<input autoComplete="name" maxLength={60} required={mode === 'request'} value={form.parentName} onChange={set('parentName')} /></label>
          <label>Cell number{mode === 'request' ? ' *' : ' (optional)'}<input type="tel" autoComplete="tel" value={form.contact} onChange={set('contact')} required={mode === 'request' || form.sendText} /></label>
          {mode === 'request' && <>
            <label>Student (optional)<input maxLength={60} value={form.student} onChange={set('student')} /></label>
            <HouseChoice label="Family's house" value={form.requesterHouse} onChange={set('requesterHouse')} />
          </>}
          <label className="intake-check"><input type="checkbox" checked={form.sendText} onChange={check('sendText')}
            disabled={mode === 'request' && form.coordination === 'family'} />Send confirmation text</label>
          <p className="fine">Includes a link for future requests. No text is sent unless selected, except when you explicitly choose family scheduling below.</p>
        </details>
        {mode === 'request' && <>
          <fieldset><legend>Who arranges pickup?</legend>
            <label className="intake-check"><input type="radio" name="coordination" value="holder" checked={form.coordination === 'holder'} onChange={set('coordination')} />I'm coordinating the handoff</label>
            <label className="intake-check"><input type="radio" name="coordination" value="family" checked={form.coordination === 'family'} onChange={set('coordination')} />Let the family arrange pickup (sends the usual text)</label>
          </fieldset>
          {form.coordination === 'holder' && <label>Agreed pickup or coordination note (optional)<textarea maxLength={200} value={form.pickupNote} onChange={set('pickupNote')} /></label>}
          <label>Request note (optional)<textarea maxLength={200} value={form.note} onChange={set('note')} /></label>
        </>}
        {error && <p role="alert" className="err">{error}</p>}
        <button className="btn flame wide" type="submit">{busy ? 'Saving…' : mode === 'giveaway' ? 'Record giveaway' : 'Save family request'}</button>
      </fieldset>
    </form>
  </section>;
}

export function HolderRequestActions({ token, request, reload }) {
  const [note, setNote] = useState(request.pickup_note || '');
  const [date, setDate] = useState(request.handoff_date || '');
  const [sendText, setSendText] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [keys, setKeys] = useState(() => ({ plan: crypto.randomUUID(), complete: crypto.randomUUID() }));
  const act = async action => {
    if (busy) return; setBusy(true); setError('');
    try {
      await db.holderAction(token, action, { key: keys[action], requestId: request.id, note, date, sendText });
      setMessage(action === 'complete' ? 'Handoff recorded. Thank you!' : 'Pickup saved. You are coordinating this handoff.');
      if (action === 'plan') setKeys(k => ({ ...k, plan: crypto.randomUUID() }));
      setSendText(false);
      reload();
    } catch (e) { setError(e.message); }
    finally { setBusy(false); }
  };
  return <details className="holder-request-actions"><summary>Manage this handoff</summary>
    <div className="intake-form">
      <p>{typeLabel(request.item_type)}: {request.qty} for {request.parent_name}</p>
      <label>Agreed pickup date (optional)<input type="date" value={date} onChange={e => setDate(e.target.value)} /></label>
      <label>Pickup note (optional)<textarea maxLength={200} value={note} onChange={e => setNote(e.target.value)} /></label>
      <label className="intake-check"><input type="checkbox" checked={sendText} onChange={e => setSendText(e.target.checked)} />Send confirmation text</label>
      {request.status === 'open' && <p className="fine">Waiting for stock. Record the handoff after an item is assigned.</p>}<div className="intake-actions">
        <button type="button" className="btn small" disabled={busy} onClick={() => act('plan')}>Save agreed pickup</button>
        <button type="button" className="btn small flame" disabled={busy || request.status === 'open'} onClick={() => act('complete')}>Mark handed over</button>
      </div>
      {message && <p role="status">{message}</p>}{error && <p role="alert" className="err">{error}</p>}
    </div>
  </details>;
}
