import { useState } from 'react';
import { adminList, adminHideComment, adminRemovePhoto } from '../api.js';
import { houseName } from '../model.js';

/* The RSVP back office at /rsvp/<slug>#admin. Same passcode as the committee
   back office, checked inside Postgres. It is a list. */

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit', timeZone: 'America/New_York' }) : '';

function cell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

export function toCsv(rows) {
  const head = ['RSVP', 'Status', 'Name', 'Phone', 'Email', 'House', 'Grades', 'Plus one', 'Photo', 'Confirmation email'];
  const body = rows.map((r) => [
    fmt(r.created_at), r.status, r.full_name, r.phone, r.email, houseName(r.house),
    (r.grades || []).join('; '), r.plus_one_name, r.photo_url ? 'yes' : '',
    r.confirm_sent_at ? fmt(r.confirm_sent_at) : r.confirm_error ? `FAILED: ${r.confirm_error}` : 'not sent',
  ].map(cell).join(','));
  return [head.map(cell).join(','), ...body].join('\r\n');
}

export default function Admin({ slug }) {
  const [pass, setPass] = useState('');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  const load = async (p = pass) => {
    setError('');
    try {
      setData(await adminList(p, slug));
    } catch (e) {
      setError(e.message || 'Could not load.');
    }
  };

  const download = () => {
    const blob = new Blob(['﻿' + toCsv(data.rsvps)], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `rcap-rsvp-${slug}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  if (!data) {
    return (
      <main className="rv-admin">
        <h1>RSVP back office</h1>
        <form onSubmit={(e) => { e.preventDefault(); load(); }}>
          <input type="password" value={pass} onChange={(e) => setPass(e.target.value)} placeholder="Passcode" autoFocus />
          <button className="rv-cta">Open</button>
        </form>
        {error && <p className="rv-failure">{error}</p>}
      </main>
    );
  }

  const going = data.rsvps.filter((r) => r.status === 'going');
  return (
    <main className="rv-admin">
      <h1>{data.event.title}</h1>
      <p>{data.event.going_count} going, counting plus ones. {going.length} RSVPs, {data.rsvps.length - going.length} cancelled.</p>
      <p><button className="rv-cta" onClick={download}>Download CSV</button> <button className="rv-ghost" onClick={() => load()}>Refresh</button></p>

      <h2>RSVPs</h2>
      <div className="rv-table-wrap">
        <table>
          <thead><tr><th>When</th><th>Name</th><th>Phone</th><th>Email</th><th>House</th><th>Grades</th><th>+1</th><th>Photo</th><th>Email sent</th></tr></thead>
          <tbody>
            {data.rsvps.map((r) => (
              <tr key={r.id} className={r.status !== 'going' ? 'off' : ''}>
                <td>{fmt(r.created_at)}{r.status !== 'going' ? ' (cancelled)' : ''}</td>
                <td>{r.full_name}</td><td>{r.phone}</td><td>{r.email}</td>
                <td>{houseName(r.house)}</td><td>{(r.grades || []).join(', ')}</td><td>{r.plus_one_name}</td>
                <td>{r.photo_url && (
                  <span className="rv-admin-photo">
                    <img src={r.photo_url} alt="" width="40" height="40" />
                    <button className="rv-link danger" onClick={async () => { await adminRemovePhoto(pass, r.id); load(); }}>Remove</button>
                  </span>
                )}</td>
                <td>{r.confirm_sent_at ? fmt(r.confirm_sent_at) : r.confirm_error ? `Failed: ${r.confirm_error}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>The thread</h2>
      <ul className="rv-admin-thread">
        {data.comments.map((c) => (
          <li key={c.id} className={c.hidden ? 'off' : ''}>
            <b>{c.full_name}</b> <small>{fmt(c.created_at)}</small>
            <p>{c.body}</p>
            <button className="rv-link" onClick={async () => { await adminHideComment(pass, c.id, !c.hidden); load(); }}>
              {c.hidden ? 'Unhide' : 'Hide'}
            </button>
          </li>
        ))}
        {!data.comments.length && <li>No comments yet.</li>}
      </ul>
    </main>
  );
}
