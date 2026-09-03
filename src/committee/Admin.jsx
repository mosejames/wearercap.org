import { useState } from 'react';
import { adminList } from './api.js';
import { byId, COMMITTEES } from './data.js';

/* The back office.
   Read-only on purpose. Everything here is either a fact about a submission or
   a way to get the whole set out as CSV; nothing edits a parent's answers,
   because the moment the board can quietly rewrite what someone said, the
   record stops being what they said. */

const NAMES = Object.fromEntries(COMMITTEES.map((c) => [c.id, c.name]));
const cname = (id) => NAMES[id] || id;

const fmt = (iso) =>
  iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }) : '';

/* Excel decides a field is a formula if it starts with = + - or @, so a name
   like "=Smith" becomes a broken cell or worse. Prefix those with a quote. */
function cell(v) {
  let s = v == null ? '' : String(v);
  if (/^[=+\-@]/.test(s)) s = "'" + s;
  return '"' + s.replace(/"/g, '""') + '"';
}

function toCsv(rows) {
  const head = [
    'Submitted', 'Status', 'Name', 'Email', 'Phone', 'House', 'Students',
    'Committees', 'Wants to lead', 'Chair applications', 'Confirmation email', 'Personality',
  ];
  const body = rows.map((r) => [
    fmt(r.created_at),
    r.status,
    r.name,
    r.email,
    r.phone,
    (r.students || []).map((s) => s.house).find(Boolean) || '',
    (r.students || []).map((s) => [s.name, s.year].filter(Boolean).join(' ')).join('; '),
    (r.committees || []).map(cname).join('; '),
    r.wants_to_lead ? 'yes' : '',
    (r.chair_picks || [])
      .map((c) => `${cname(c.committee)} (${c.role}${c.chaired_before ? ', chaired before' : ''}): ${c.why || ''}`)
      .join(' | '),
    r.confirm_sent_at ? fmt(r.confirm_sent_at) : (r.confirm_error ? 'FAILED: ' + r.confirm_error : 'not sent'),
    (r.personality || []).join('; '),
  ].map(cell).join(','));
  return [head.map(cell).join(','), ...body].join('\r\n');
}

function download(rows) {
  // BOM so Excel opens UTF-8 names correctly instead of mangling them.
  const blob = new Blob(['\ufeff' + toCsv(rows)], { type: 'text/csv;charset=utf-8' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `rcap-committee-interest-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(a.href);
}

export default function Admin() {
  const [pass, setPass] = useState('');
  const [rows, setRows] = useState(null);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);
  const [filter, setFilter] = useState('all');
  const [openRow, setOpenRow] = useState(null);

  async function load(p) {
    setBusy(true); setErr('');
    try {
      setRows(await adminList(p));
    } catch (e) {
      setErr(String(e?.message || e).includes('passcode') ? 'Wrong passcode.' : 'Could not load.');
      setRows(null);
    } finally { setBusy(false); }
  }

  if (!rows) {
    return (
      <section className="screen">
        <div className="inner" style={{ maxWidth: 380 }}>
          <p className="eyebrow">Back office</p>
          <h2 className="q" style={{ fontSize: 34 }}>Committee interest</h2>
          <input
            className="bigfield" type="password" value={pass} autoFocus
            style={{ fontSize: 22 }} placeholder="Passcode"
            onChange={(e) => setPass(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') load(pass); }}
          />
          {err && <p className="err">{err}</p>}
          <div className="row">
            <button className="btn solid" disabled={busy} onClick={() => load(pass)}>
              {busy ? 'Checking' : 'Open'}
            </button>
          </div>
        </div>
      </section>
    );
  }

  const complete = rows.filter((r) => r.status === 'complete');
  const partial = rows.filter((r) => r.status !== 'complete');
  const leads = complete.filter((r) => (r.chair_picks || []).length);
  const shown = filter === 'complete' ? complete : filter === 'partial' ? partial : filter === 'chairs' ? leads : rows;

  /* How many hands per committee, counting finished submissions only. */
  const tally = COMMITTEES.map((c) => ({
    c,
    n: complete.filter((r) => (r.committees || []).includes(c.id)).length,
    chairs: complete.filter((r) => (r.chair_picks || []).some((p) => p.committee === c.id)).length,
  })).sort((a, b) => b.n - a.n);

  return (
    <section className="screen wide">
      <div className="inner big">
        <div className="ad-head">
          <div>
            <p className="eyebrow" style={{ margin: 0 }}>Back office</p>
            <h2 className="q" style={{ fontSize: 34 }}>Committee interest</h2>
          </div>
          <div className="ad-actions">
            <button className="btn ghost small" onClick={() => load(pass)}>Refresh</button>
            <button className="btn flame small" onClick={() => download(rows)}>Download CSV</button>
          </div>
        </div>

        <div className="ad-stats">
          <div className="ad-stat"><b>{complete.length}</b><span>submitted</span></div>
          <div className="ad-stat"><b>{partial.length}</b><span>started, unfinished</span></div>
          <div className="ad-stat"><b>{leads.length}</b><span>chair applications</span></div>
          <div className="ad-stat">
            <b>{complete.filter((r) => r.confirm_sent_at).length}</b><span>confirmations sent</span>
          </div>
        </div>

        <div className="ad-tally">
          {tally.map(({ c, n, chairs }) => (
            <div className="ad-t" data-a={c.accent} key={c.id}>
              <b>{n}</b>
              <span>{c.name}</span>
              {chairs > 0 && <i>{chairs} for chair</i>}
            </div>
          ))}
        </div>

        <div className="seg">
          {[['all', 'Everyone'], ['complete', 'Submitted'], ['partial', 'Unfinished'], ['chairs', 'Chair applications']]
            .map(([k, label]) => (
              <button key={k} className={filter === k ? 'on' : ''} onClick={() => setFilter(k)}>{label}</button>
            ))}
        </div>

        {!shown.length && <p className="sub">Nothing here yet.</p>}

        <div className="ad-rows">
          {shown.map((r) => {
            const open = openRow === r.id;
            return (
              <div className={'ad-row' + (r.status !== 'complete' ? ' part' : '')} key={r.id}>
                <button className="ad-r-top" onClick={() => setOpenRow(open ? null : r.id)}>
                  <span className="ad-r-name">
                    {r.name || '(no name)'}
                    {r.status !== 'complete' && <em>unfinished</em>}
                  </span>
                  <span className="ad-r-meta">
                    {(r.committees || []).length} picked
                    {(r.chair_picks || []).length ? ` · ${r.chair_picks.length} chair` : ''}
                    {' · '}{fmt(r.created_at)}
                  </span>
                </button>
                {open && (
                  <div className="ad-r-body">
                    <dl>
                      <dt>Email</dt><dd><a href={'mailto:' + r.email}>{r.email}</a></dd>
                      <dt>Phone</dt><dd>{r.phone || '—'}</dd>
                      <dt>Students</dt>
                      <dd>{(r.students || []).map((s) => [s.name, s.year, s.house].filter(Boolean).join(', ')).join(' · ') || '—'}</dd>
                      <dt>Committees</dt>
                      <dd>{(r.committees || []).map(cname).join(', ') || '—'}</dd>
                      <dt>Confirmation</dt>
                      <dd>
                        {r.confirm_sent_at
                          ? 'Sent ' + fmt(r.confirm_sent_at)
                          : r.confirm_error
                            ? <span className="ad-fail">Failed: {r.confirm_error}</span>
                            : 'Not sent'}
                      </dd>
                    </dl>
                    {(r.chair_picks || []).map((p) => (
                      <div className="ad-chair" key={p.committee}>
                        <b>{cname(p.committee)} · {p.role}{p.chaired_before ? ' · has chaired before' : ''}</b>
                        {p.why && <p>{p.why}</p>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <p className="ad-foot">
          Read-only. {rows.length} row{rows.length === 1 ? '' : 's'}. Unfinished rows are parents who gave a
          name and email and stopped; they are still worth a follow-up.
        </p>
      </div>
    </section>
  );
}
