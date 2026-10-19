import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft, ArrowDown, ArrowUp, ArrowRight, Check, Copy, Download, ExternalLink, Globe, ImagePlus,
  LogOut, Mail, Plus, Sparkles, Trash2, UserPlus, Users, X,
} from 'lucide-react';
import { supabase, call, uploadPhoto } from './api.js';
import {
  BLOCKS, FORMATS, newBlock, newDate, template, renderEmail, renderDocument, plainText,
  styleCheck, fixDashes, suggestSlug, slugify, longDate, SITE,
} from './render.js';
import { loadGoogleIdentity, createGoogleNonce, GOOGLE_CLIENT_ID } from '../carpool/googleIdentity.js';

const today = () => new Date().toLocaleDateString('en-CA', { timeZone: 'America/New_York' });
const stamp = (v) => new Date(v).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
const webUrl = (issue) => (issue?.status === 'published' && issue.slug ? `${SITE}/newsletter/${issue.slug}` : '');

// ---------------------------------------------------------------------------
// Sign in
// ---------------------------------------------------------------------------
function GoogleButton({ onError }) {
  const mount = useRef(null);
  useEffect(() => {
    let live = true;
    (async () => {
      try {
        if (!GOOGLE_CLIENT_ID) return;
        const id = await loadGoogleIdentity();
        const { nonce, hashedNonce } = await createGoogleNonce();
        if (!live) return;
        id.initialize({
          client_id: GOOGLE_CLIENT_ID, nonce: hashedNonce,
          callback: async ({ credential }) => {
            const { error } = await supabase.auth.signInWithIdToken({ provider: 'google', token: credential, nonce });
            if (error) onError(error.message);
          },
        });
        id.renderButton(mount.current, { theme: 'outline', size: 'large', width: 280, shape: 'pill' });
      } catch { if (live) onError('Google sign-in is unavailable. Use your email below.'); }
    })();
    return () => { live = false; };
  }, [onError]);
  return <div ref={mount} className="nb-google" />;
}

function Landing({ onError }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  async function send(e) {
    e.preventDefault(); setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { emailRedirectTo: location.origin + '/newsletter/builder/' } });
      if (error) throw error;
      setSent(true);
    } catch (err) { onError(err.message); } finally { setBusy(false); }
  }
  return (
    <main className="nb-landing">
      <section className="nb-landing-copy">
        <p className="nb-kicker on-dark">For RCAP officers</p>
        <h1>Every note.<br /><em>One place.</em></h1>
        <p>Write the week's newsletter in plain English, see it exactly as families will, then copy it straight into Gmail.</p>
        <ul className="nb-points">
          <li><Check size={16} /> Quick Hello or Full Issue</li>
          <li><Check size={16} /> Live preview as you type</li>
          <li><Check size={16} /> Every issue saved on wearercap.org</li>
        </ul>
      </section>
      <section className="nb-login">
        <p className="nb-kicker">Sign in</p>
        <h2>Use your invited email.</h2>
        <GoogleButton onError={onError} />
        <span className="nb-or">or get a sign-in link</span>
        <form onSubmit={send}>
          <label htmlFor="nb-email">Your email</label>
          <input id="nb-email" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" />
          <button className="nb-btn primary" disabled={busy}>Send my link <ArrowRight size={16} /></button>
        </form>
        {sent && <p className="nb-ok" role="status">Check your email for the sign-in link.</p>}
      </section>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
function Officers({ me, onError }) {
  const [list, setList] = useState(null);
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [copied, setCopied] = useState('');
  const load = useCallback(() => call('editors').then(setList).catch((e) => onError(e.message)), [onError]);
  useEffect(() => { load(); }, [load]);
  async function invite(e) {
    e.preventDefault();
    try { await call('invite', { email, name }); setEmail(''); setName(''); load(); } catch (err) { onError(err.message); }
  }
  async function copyInvite(person) {
    const first = (person.name || '').split(' ')[0];
    const text = `${first ? `Hi ${first}, ` : ''}you're set up to build RCAP newsletters. Sign in at ${SITE}/newsletter/builder/ with ${person.email}.`;
    try { await navigator.clipboard.writeText(text); setCopied(person.email); setTimeout(() => setCopied(''), 2500); } catch { onError(text); }
  }
  return (
    <section className="nb-panel">
      <p className="nb-kicker"><Users size={14} /> Who can build</p>
      <h2>Officers with access.</h2>
      <ul className="nb-people">
        {(list || []).map((p) => (
          <li key={p.email}>
            <div><strong>{p.name || p.email}</strong><span>{p.name ? `${p.email} · ` : ''}{p.role === 'owner' ? 'Chair' : p.joined ? 'Signed in' : 'Invited'}</span></div>
            {p.role !== 'owner' && <div className="nb-row-actions">
              <button className="nb-icon" onClick={() => copyInvite(p)} aria-label={`Copy an invite message for ${p.email}`}>{copied === p.email ? <Check size={16} /> : <Copy size={16} />}</button>
              {me.role === 'owner' && <button className="nb-icon" onClick={async () => { try { await call('remove', { email: p.email }); load(); } catch (e) { onError(e.message); } }} aria-label={`Remove ${p.email}`}><X size={16} /></button>}
            </div>}
          </li>
        ))}
      </ul>
      {me.role === 'owner' && (
        <form className="nb-invite" onSubmit={invite}>
          <div><label htmlFor="nb-inv-name">Name</label><input id="nb-inv-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Farren Salter" /></div>
          <div><label htmlFor="nb-inv-email">Email</label><input id="nb-inv-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@example.com" /></div>
          <button className="nb-btn dark"><UserPlus size={16} /> Add officer</button>
          <p className="nb-help">They sign in with this email. Use the copy button to send them the link.</p>
        </form>
      )}
    </section>
  );
}

function Dashboard({ me, onOpen, onError }) {
  const [issues, setIssues] = useState(null);
  const [busy, setBusy] = useState(false);
  const load = useCallback(() => call('list').then(setIssues).catch((e) => onError(e.message)), [onError]);
  useEffect(() => { load(); }, [load]);
  async function start(format) {
    setBusy(true);
    try {
      const d = today();
      const issue = await call('create', { format, title: `${FORMATS[format].label}, ${longDate(d)}`, content: template(format, d) });
      onOpen(issue.id);
    } catch (e) { onError(e.message); } finally { setBusy(false); }
  }
  async function copyIssue(id) {
    setBusy(true);
    try { const issue = await call('create', { from: id }); onOpen(issue.id); } catch (e) { onError(e.message); } finally { setBusy(false); }
  }
  async function remove(issue) {
    if (!window.confirm(`Delete the draft "${issue.title}"? This cannot be undone.`)) return;
    try { await call('delete', { id: issue.id }); load(); } catch (e) { onError(e.message); }
  }
  return (
    <main className="nb-dash">
      <section className="nb-dash-head">
        <p className="nb-kicker">Welcome back{me.name ? `, ${me.name.split(' ')[0]}` : ''}</p>
        <h1>What are we <span className="hl">sending?</span></h1>
      </section>
      <section className="nb-starts">
        {Object.entries(FORMATS).map(([key, f]) => (
          <button key={key} className={`nb-start ${key}`} disabled={busy} onClick={() => start(key)}>
            <span className="nb-kicker">{key === 'quick' ? 'Most weeks' : 'Worth dressing up'}</span>
            <strong>{f.label}</strong>
            <span>{f.blurb}</span>
            <em>Start <ArrowRight size={16} className="arr" /></em>
          </button>
        ))}
      </section>
      <section className="nb-panel">
        <p className="nb-kicker">Your issues</p>
        {issues === null ? <p className="nb-help">Loading…</p> : issues.length === 0 ? <p className="nb-help">Nothing yet. Start a Quick Hello above.</p> : (
          <ul className="nb-issues">
            {issues.map((i) => (
              <li key={i.id}>
                <button className="nb-issue-open" onClick={() => onOpen(i.id)}>
                  <span className={`nb-pill ${i.status}`}>{i.status === 'published' ? 'On the website' : 'Draft'}</span>
                  <strong>{i.title || 'Untitled issue'}</strong>
                  <span>{FORMATS[i.format]?.label} · edited {stamp(i.updated_at)}</span>
                </button>
                <div className="nb-row-actions">
                  {i.status === 'published' && <a className="nb-icon" href={webUrl(i)} target="_blank" rel="noreferrer" aria-label="View on the website"><ExternalLink size={16} /></a>}
                  <button className="nb-icon" onClick={() => copyIssue(i.id)} aria-label={`Start a new issue from ${i.title}`} title="Start a new issue from this one"><Copy size={16} /></button>
                  {i.status !== 'published' && (me.role === 'owner' || i.created_by === me.email) && <button className="nb-icon" onClick={() => remove(i)} aria-label={`Delete ${i.title}`}><Trash2 size={16} /></button>}
                </div>
              </li>
            ))}
          </ul>
        )}
        <p className="nb-help">Copying an issue keeps its layout and words so you only change what is new.</p>
      </section>
      <Officers me={me} onError={onError} />
    </main>
  );
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------
function Field({ label, hint, value, onChange, area, rows = 3, ...rest }) {
  const id = useMemo(() => `f-${Math.random().toString(36).slice(2, 9)}`, []);
  return (
    <div className="nb-field">
      <label htmlFor={id}>{label}</label>
      {area
        ? <textarea id={id} rows={rows} value={value || ''} onChange={(e) => onChange(e.target.value)} {...rest} />
        : <input id={id} value={value || ''} onChange={(e) => onChange(e.target.value)} {...rest} />}
      {hint && <p className="nb-help">{hint}</p>}
    </div>
  );
}

function LinkPair({ label, value = {}, onChange, labelHint = 'Button words' }) {
  return (
    <div className="nb-pair">
      <Field label={`${label}: ${labelHint}`} value={value.label} onChange={(v) => onChange({ ...value, label: v })} placeholder="RSVP for the social" />
      <Field label={`${label}: link`} value={value.url} onChange={(v) => onChange({ ...value, url: v })} placeholder="wearercap.org/karaoke" inputMode="url" autoCapitalize="off" />
    </div>
  );
}

function ImageField({ issueId, value = {}, onChange, onError }) {
  const input = useRef(null);
  const [busy, setBusy] = useState(false);
  async function pick(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try { onChange({ ...value, url: await uploadPhoto(issueId, file) }); } catch (err) { onError(err.message); } finally { setBusy(false); }
  }
  return (
    <div className="nb-image">
      {value.url ? <img src={value.url} alt="" /> : <div className="nb-image-empty"><ImagePlus size={22} /></div>}
      <div className="nb-image-fields">
        <div className="nb-image-actions">
          <button type="button" className="nb-btn ghost small" disabled={busy} onClick={() => input.current?.click()}><ImagePlus size={15} /> {busy ? 'Adding…' : value.url ? 'Replace photo' : 'Add a photo'}</button>
          {value.url && <button type="button" className="nb-btn ghost small" onClick={() => onChange({ url: '', alt: '' })}>Remove</button>}
        </div>
        <input ref={input} type="file" accept="image/*,.heic,.heif" hidden onChange={pick} />
        <Field label="Or paste an image link" value={value.url} onChange={(v) => onChange({ ...value, url: v })} placeholder="https://wearercap.org/images/..." inputMode="url" autoCapitalize="off" />
        <Field label="Describe the photo" value={value.alt} onChange={(v) => onChange({ ...value, alt: v })} placeholder="Parents greeting guests at EXP" />
      </div>
    </div>
  );
}

const BODY_HINT = 'Blank line for a new paragraph. **Bold** a phrase. [Link words](wearercap.org/page) for a link.';

function BlockEditor({ block, update, issueId, onError }) {
  const set = (k) => (v) => update({ ...block, [k]: v });
  switch (block.type) {
    case 'photo':
      return <>
        <ImageField issueId={issueId} value={block.image} onChange={set('image')} onError={onError} />
        <Field label="Where a tap goes (optional)" value={block.href} onChange={set('href')} placeholder="wearercap.org/rcap-capsule" inputMode="url" autoCapitalize="off" />
      </>;
    case 'quote':
      return <>
        <Field area rows={3} label="What the student said" value={block.quote} onChange={set('quote')} placeholder="We have feet, not roots." hint="Real words from a real student. Never invent one." />
        <Field label="Who said it" value={block.by} onChange={set('by')} placeholder="Jordan, Class of 2029" />
      </>;
    case 'dates':
      return <>
        <div className="nb-pair">
          <Field label="Small label" value={block.kicker} onChange={set('kicker')} />
          <Field label="Heading" value={block.heading} onChange={set('heading')} />
        </div>
        <ol className="nb-dates">
          {(block.items || []).map((item, n) => {
            const put = (patch) => update({ ...block, items: block.items.map((x) => (x.id === item.id ? { ...x, ...patch } : x)) });
            return (
              <li key={item.id}>
                <div className="nb-pair">
                  <Field label="When" value={item.when} onChange={(v) => put({ when: v })} placeholder="Thu, Nov 5" />
                  <Field label="What" value={item.what} onChange={(v) => put({ what: v })} placeholder="RCA EXP" />
                </div>
                <div className="nb-pair">
                  <Field label="Details" value={item.detail} onChange={(v) => put({ detail: v })} placeholder="Volunteers needed, 7:30 a.m." />
                  <Field label="Link (optional)" value={item.url} onChange={(v) => put({ url: v })} placeholder="signupgenius.com/..." inputMode="url" autoCapitalize="off" />
                </div>
                {block.items.length > 1 && <button type="button" className="nb-text" onClick={() => update({ ...block, items: block.items.filter((x) => x.id !== item.id) })}>Remove date {n + 1}</button>}
              </li>
            );
          })}
        </ol>
        {(block.items || []).length < 10 && <button type="button" className="nb-btn ghost small" onClick={() => update({ ...block, items: [...(block.items || []), newDate()] })}><Plus size={15} /> Add a date</button>}
      </>;
    case 'note':
      return <>
        <div className="nb-pair">
          <Field label="Small label" value={block.kicker} onChange={set('kicker')} />
          <Field label="Heading" value={block.heading} onChange={set('heading')} placeholder="Missed the meeting?" />
        </div>
        <Field area label="A few words" value={block.body} onChange={set('body')} hint={BODY_HINT} />
        <LinkPair label="Link" labelHint="link words" value={block.link} onChange={set('link')} />
      </>;
    default:
      return <>
        <div className="nb-pair">
          <Field label="Small label" value={block.kicker} onChange={set('kicker')} placeholder="Sunday, September 27" />
          <Field label="Heading" value={block.heading} onChange={set('heading')} placeholder="Your Sunday plans." />
        </div>
        <Field area rows={5} label="The story" value={block.body} onChange={set('body')} hint={BODY_HINT} />
        <ImageField issueId={issueId} value={block.image} onChange={set('image')} onError={onError} />
        <LinkPair label="Button" value={block.button} onChange={set('button')} />
        <LinkPair label="Extra link" labelHint="link words" value={block.link} onChange={set('link')} />
        <div className="nb-tone" role="radiogroup" aria-label="Background">
          {[['paper', 'Paper'], ['sand', 'Sand']].map(([v, l]) => (
            <button key={v} type="button" role="radio" aria-checked={(block.tone || 'paper') === v} className={(block.tone || 'paper') === v ? 'on' : ''} onClick={() => update({ ...block, tone: v })}><i className={v} />{l}</button>
          ))}
        </div>
      </>;
  }
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------
function Preview({ html, active }) {
  const frame = useRef(null);
  const [height, setHeight] = useState(900);
  // A hidden iframe (phone Edit tab) measures as zero, so measure again
  // whenever the preview becomes visible, and after images arrive.
  const fit = useCallback(() => {
    const doc = frame.current?.contentDocument;
    const h = doc?.documentElement?.scrollHeight || 0;
    if (h > 50) setHeight(h + 8);
  }, []);
  useEffect(() => {
    const f = frame.current;
    if (!f) return;
    const onLoad = () => {
      fit();
      for (const img of f.contentDocument?.images || []) img.addEventListener('load', fit, { once: true });
    };
    f.addEventListener('load', onLoad);
    return () => f.removeEventListener('load', onLoad);
  }, [fit]);
  useEffect(() => { if (active) { const t = setTimeout(fit, 30); return () => clearTimeout(t); } }, [active, fit, html]);
  return <iframe ref={frame} className="nb-frame" title="Newsletter preview" srcDoc={html} style={{ height }} sandbox="allow-same-origin" />;
}

function Editor({ id, me, onBack, onError, demo = null }) {
  const [issue, setIssue] = useState(null);
  const [content, setContent] = useState(null);
  const [meta, setMeta] = useState({ title: '', issue_date: today() });
  const [save, setSave] = useState('saved');
  const [view, setView] = useState('edit');
  const [notice, setNotice] = useState('');
  const [slug, setSlug] = useState('');
  const [adding, setAdding] = useState(false);
  const revision = useRef(0);
  const timer = useRef(null);
  const pending = useRef(null);
  const copyRef = useRef(null);

  useEffect(() => {
    (demo ? Promise.resolve(demo) : call('load', { id })).then((d) => {
      setIssue(d); setContent(d.content); setMeta({ title: d.title, issue_date: d.issue_date });
      setSlug(d.slug || suggestSlug(d.content, d.issue_date)); revision.current = d.revision;
    }).catch((e) => onError(e.message));
  }, [id, onError, demo]);

  const flush = useCallback(async () => {
    clearTimeout(timer.current);
    const next = pending.current;
    if (!next) return;
    pending.current = null;
    if (demo) { setSave('saved'); return; }
    setSave('saving');
    try {
      const s = await call('save', { id, content: next.content, title: next.meta.title, issue_date: next.meta.issue_date, expected_revision: revision.current });
      revision.current = s.revision; setIssue((i) => ({ ...i, ...s })); setSave(pending.current ? 'pending' : 'saved');
    } catch (e) { setSave('error'); onError(e.message); }
  }, [id, onError]);

  const queue = useCallback((c, m) => {
    pending.current = { content: c, meta: m };
    setSave('pending');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, 1200);
  }, [flush]);

  useEffect(() => {
    const leave = (e) => { if (pending.current) { flush(); e.preventDefault(); e.returnValue = ''; } };
    window.addEventListener('beforeunload', leave);
    return () => {
      window.removeEventListener('beforeunload', leave);
      // Closing the editor (All issues or the back button) saves what is waiting.
      if (pending.current) flush(); else clearTimeout(timer.current);
    };
  }, [flush]);

  const html = useMemo(() => (content ? renderDocument(content, { webUrl: webUrl(issue) }) : ''), [content, issue]);
  const notes = useMemo(() => (content ? styleCheck(content) : []), [content]);
  if (!content) return <p className="nb-loading" role="status">Opening the issue…</p>;

  const edit = (patch) => { const c = { ...content, ...patch }; setContent(c); queue(c, meta); };
  const editMeta = (patch) => { const m = { ...meta, ...patch }; setMeta(m); queue(content, m); };
  const blocks = content.blocks || [];
  const setBlocks = (b) => edit({ blocks: b });
  const move = (n, d) => { const b = [...blocks]; [b[n], b[n + d]] = [b[n + d], b[n]]; setBlocks(b); };
  const flash = (t) => { setNotice(t); setTimeout(() => setNotice(''), 3000); };

  async function copyEmail() {
    const inner = renderEmail(content, { webUrl: webUrl(issue) });
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'text/html': new Blob([inner], { type: 'text/html' }), 'text/plain': new Blob([plainText(content)], { type: 'text/plain' }) })]);
      flash('Copied with formatting. Open a new Gmail message and paste.');
    } catch {
      const el = copyRef.current;
      el.innerHTML = inner;
      const range = document.createRange(); range.selectNodeContents(el);
      const sel = window.getSelection(); sel.removeAllRanges(); sel.addRange(range);
      let ok = false; try { ok = document.execCommand('copy'); } catch { /* fall through */ }
      sel.removeAllRanges(); el.innerHTML = '';
      flash(ok ? 'Copied. Paste into a new Gmail message.' : 'Your browser blocked copying. Use Download instead.');
    }
  }
  async function copySubject() {
    try { await navigator.clipboard.writeText(content.subject || ''); flash('Subject copied.'); } catch { flash(`Subject: ${content.subject}`); }
  }
  function download() {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([html], { type: 'text/html' }));
    a.download = `rcap-newsletter-${meta.issue_date}.html`;
    a.click(); setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  async function publish(on) {
    await flush();
    if (demo) { flash('Preview mode. Sign in to publish.'); return; }
    try {
      const s = await call(on ? 'publish' : 'unpublish', { id, slug: slugify(slug) });
      revision.current = s.revision; setIssue((i) => ({ ...i, ...s }));
      flash(on ? 'It is on the website.' : 'Taken off the website. It is a draft again.');
    } catch (e) { onError(e.message); }
  }

  const live = webUrl(issue);
  const label = { saved: 'Saved', saving: 'Saving…', pending: 'Editing', error: 'Not saved' }[save];

  return (
    <div className={`nb-editor view-${view}`}>
      <div className="nb-toolbar">
        <button className="nb-text" onClick={async () => { await flush(); onBack(); }}><ArrowLeft size={16} /> All issues</button>
        <span className={`nb-save ${save}`} role="status">{label}</span>
        <div className="nb-switch" role="tablist" aria-label="Edit or preview">
          <button role="tab" aria-selected={view === 'edit'} onClick={() => setView('edit')}>Edit</button>
          <button role="tab" aria-selected={view === 'preview'} onClick={() => setView('preview')}>Preview</button>
        </div>
      </div>
      <div className="nb-split">
        <div className="nb-form">
          <header className="nb-form-head">
            <p className="nb-kicker">{FORMATS[issue.format]?.label} · <span className={`nb-pill ${issue.status}`}>{issue.status === 'published' ? 'On the website' : 'Draft'}</span></p>
            <Field label="Name for your list (families never see this)" value={meta.title} onChange={(v) => editMeta({ title: v })} />
          </header>

          <section className="nb-card">
            <h3><span className="num">1</span> Sending</h3>
            <Field label="Subject line" value={content.subject} onChange={(v) => edit({ subject: v })} placeholder="This is how we do it, RCAP" />
            <Field label="Preview text" value={content.preheader} onChange={(v) => edit({ preheader: v })} hint="The gray line people see after the subject in their inbox." placeholder="Karaoke, EXP, and the Bingo Night photos." />
            <div className="nb-pair">
              <Field label="Issue date" type="date" value={meta.issue_date} onChange={(v) => editMeta({ issue_date: v })} />
              <Field label="Line under the logo" value={content.dateline} onChange={(v) => edit({ dateline: v })} />
            </div>
          </section>

          <section className="nb-card">
            <h3><span className="num">2</span> Opening</h3>
            <Field label="Small label" value={content.kicker} onChange={(v) => edit({ kicker: v })} />
            <Field area rows={2} label="Headline" value={content.headline} onChange={(v) => edit({ headline: v })} placeholder={'This is how\nwe do it.'} hint="Press return to choose where the line breaks." />
            <Field label="Greeting" value={content.greeting} onChange={(v) => edit({ greeting: v })} />
            <Field area rows={issue.format === 'full' ? 7 : 4} label={issue.format === 'full' ? 'Your letter' : 'Your note'} value={content.body} onChange={(v) => edit({ body: v })} hint={BODY_HINT} />
            <LinkPair label="Button" value={content.button} onChange={(v) => edit({ button: v })} />
          </section>

          <section className="nb-card">
            <h3><span className="num">3</span> Sections</h3>
            {blocks.length === 0 && <p className="nb-help">No sections yet. Add one below.</p>}
            {blocks.map((b, n) => (
              <article key={b.id} className="nb-block">
                <header>
                  <span className="nb-block-name">{BLOCKS[b.type]?.label}</span>
                  <div className="nb-row-actions">
                    <button className="nb-icon" disabled={n === 0} onClick={() => move(n, -1)} aria-label="Move up"><ArrowUp size={16} /></button>
                    <button className="nb-icon" disabled={n === blocks.length - 1} onClick={() => move(n, 1)} aria-label="Move down"><ArrowDown size={16} /></button>
                    <button className="nb-icon" onClick={() => setBlocks(blocks.filter((x) => x.id !== b.id))} aria-label={`Remove ${BLOCKS[b.type]?.label}`}><Trash2 size={16} /></button>
                  </div>
                </header>
                <BlockEditor block={b} issueId={id} onError={onError} update={(nb) => setBlocks(blocks.map((x) => (x.id === b.id ? nb : x)))} />
              </article>
            ))}
            {adding ? (
              <div className="nb-add">
                {FORMATS[issue.format].blocks.map((t) => (
                  <button key={t} className="nb-add-option" onClick={() => { setBlocks([...blocks, newBlock(t)]); setAdding(false); }}>
                    <strong>{BLOCKS[t].label}</strong><span>{BLOCKS[t].hint}</span>
                  </button>
                ))}
                <button className="nb-text" onClick={() => setAdding(false)}>Cancel</button>
              </div>
            ) : <button className="nb-btn ghost" onClick={() => setAdding(true)}><Plus size={16} /> Add a section</button>}
          </section>

          <section className="nb-card">
            <h3><span className="num">4</span> Closing</h3>
            <Field label="Sign-off" value={content.signoff} onChange={(v) => edit({ signoff: v })} />
            <div className="nb-pair">
              <Field label="Name" value={content.signer} onChange={(v) => edit({ signer: v })} />
              <Field label="Role" value={content.role} onChange={(v) => edit({ role: v })} placeholder="Or Your RCAP Family" />
            </div>
          </section>

          <section className="nb-card check">
            <h3><Sparkles size={17} /> House style</h3>
            {notes.length === 0 ? <p className="nb-help">Reads clean. No dashes, no exclamation points, every photo described.</p> : (
              <ul className="nb-notes">{notes.map((n, i) => <li key={i}><strong>{n.field}</strong> {n.text}</li>)}</ul>
            )}
            {notes.some((n) => n.kind === 'dash') && <button className="nb-btn ghost small" onClick={() => edit(fixDashes(content))}>Fix the dashes for me</button>}
          </section>

          <section className="nb-card send">
            <h3><Mail size={17} /> Send it</h3>
            <p className="nb-help">Copy, open a new message in Gmail on your computer, paste. Check it once, then send from your RCAP email.</p>
            <div className="nb-actions">
              <button className="nb-btn primary" onClick={copyEmail}><Copy size={16} /> Copy for Gmail</button>
              <button className="nb-btn ghost" onClick={copySubject}>Copy subject</button>
              <button className="nb-btn ghost" onClick={download}><Download size={16} /> Download</button>
            </div>
            <div className="nb-publish">
              <p className="nb-kicker"><Globe size={14} /> On wearercap.org</p>
              {live ? <>
                <p className="nb-help">Families can read it at <a href={live} target="_blank" rel="noreferrer">{live.replace('https://', '')}</a>. Publish before you copy so the email carries a "view on the web" link.</p>
                <div className="nb-actions">
                  <button className="nb-btn dark" onClick={() => publish(true)}>Update the web page</button>
                  <button className="nb-btn ghost" onClick={() => publish(false)}>Take it down</button>
                </div>
              </> : <>
                <div className="nb-slug"><span>wearercap.org/newsletter/</span><input aria-label="Web address" value={slug} onChange={(e) => setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} /></div>
                <button className="nb-btn dark" onClick={() => publish(true)}>Put it on the website <ArrowRight size={16} className="arr" /></button>
              </>}
            </div>
          </section>
          {notice && <p className="nb-toast" role="status">{notice}</p>}
          <div ref={copyRef} className="nb-copy-buffer" aria-hidden="true" />
        </div>
        <aside className="nb-preview" aria-label="Preview">
          <p className="nb-kicker on-dark">What families will see</p>
          <Preview html={html} active={view === 'preview' || window.matchMedia?.('(min-width: 1001px)').matches} />
        </aside>
      </div>
    </div>
  );
}

function sampleIssue(format) {
  const d = today();
  const c = template(format, d);
  c.subject = format === 'quick' ? 'A quick hello from RCAP' : 'This is how we do it, RCAP';
  c.headline = format === 'quick' ? 'Three dates.\nOne family.' : 'This is how\nwe do it.';
  c.body = format === 'quick'
    ? 'A short one this week. Here is what is coming up, and where we would love to see you.'
    : 'We have a week of showing up ahead of us. A little service, a lot of music, and some memories we owe you.\n\nFirst up: clear a little room on your calendar for next Sunday.';
  for (const b of c.blocks) {
    if (b.type === 'dates') b.items = [{ id: 'a', when: 'Mon, Nov 16', what: 'RCAP General Meeting', detail: 'Time and place to come', url: '' }, { id: 'b', when: 'Your date', what: 'Your next event', detail: 'One line of details', url: '' }];
    if (b.type === 'quote') { b.quote = 'Your words from a real student go here.'; b.by = 'Name, Class of 2029'; }
    if (b.type === 'story' && b.tone !== 'sand') { b.kicker = 'Thursday + Friday'; b.heading = 'Before we sing,\nwe serve.'; b.body = 'EXP is back this week, and parent volunteers help make the welcome happen.'; b.button = { label: 'Sign up for EXP', url: 'wearercap.org' }; }
    if (b.type === 'story' && b.tone === 'sand') { b.heading = 'Thank you.'; b.body = 'Every RCA parent is already part of RCAP. Thank you for showing up for our students.'; }
    if (b.type === 'photo') { b.image = { url: '/images/rcap-community-table.jpg', alt: 'RCA parent volunteers gathered at EXP' }; }
  }
  return { id: 'preview', format, status: 'draft', title: `${FORMATS[format].label} preview`, issue_date: d, revision: 0, content: c };
}

// ---------------------------------------------------------------------------
export default function App() {
  const [user, setUser] = useState(null);
  const [me, setMe] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [open, setOpen] = useState(() => new URLSearchParams(location.search).get('issue'));
  // ?preview=quick or ?preview=full opens the editor with sample words and no
  // saving, so anyone can see how the builder works before an invite.
  const demoFormat = new URLSearchParams(location.search).get('preview');
  const demo = useMemo(() => (FORMATS[demoFormat] ? sampleIssue(demoFormat) : null), [demoFormat]);
  const onError = useCallback((m) => setError(String(m || 'Something went wrong.')), []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => { setUser(session?.user || null); setLoading(false); });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, s) => setUser(s?.user || null));
    return () => subscription.unsubscribe();
  }, []);
  useEffect(() => {
    let live = true;
    setMe(null);
    if (user) call('me').then((m) => live && setMe(m)).catch((e) => live && (setMe(false), onError(e.message)));
    return () => { live = false; };
  }, [user?.id, onError]);

  // Opening an issue adds a browser history entry, so the phone or browser
  // back button returns to All issues instead of leaving the site.
  const urlFor = (id) => {
    const u = new URL(location.href);
    if (id) u.searchParams.set('issue', id); else u.searchParams.delete('issue');
    return u;
  };
  useEffect(() => {
    // Arriving straight on ?issue=… (a shared link): put the list underneath
    // it so the first back press lands on All issues.
    const first = new URLSearchParams(location.search).get('issue');
    if (first && !history.state?.nbIssue) {
      history.replaceState(null, '', urlFor(null));
      history.pushState({ nbIssue: first }, '', urlFor(first));
    }
    const onPop = () => { setOpen(new URLSearchParams(location.search).get('issue')); window.scrollTo(0, 0); };
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);
  const go = (id) => {
    if (!id && history.state?.nbIssue) { history.back(); return; }
    setOpen(id);
    if (id) history.pushState({ nbIssue: id }, '', urlFor(id));
    else history.replaceState(null, '', urlFor(null));
    window.scrollTo(0, 0);
  };

  return (
    <div className="nb-app">
      <header className="nb-header">
        <a href="/" aria-label="RCAP home"><img src="/brand/rcap-reversed.svg" alt="RCAP" width="92" height="31" /></a>
        <span className="nb-header-title"><span className="long">The </span>Newsletter <i /> Builder</span>
        {user ? <button className="nb-text on-dark" onClick={() => supabase.auth.signOut()}><LogOut size={14} /> Sign out</button> : <a className="nb-text on-dark" href="/newsletter">Past issues</a>}
      </header>
      {error && <div className="nb-error" role="alert"><span>{error}</span><button aria-label="Dismiss" onClick={() => setError('')}><X size={16} /></button></div>}
      {demo ? <Editor id="preview" me={{ role: 'officer' }} demo={demo} onBack={() => { location.href = '/newsletter/builder/'; }} onError={onError} />
        : loading ? <p className="nb-loading" role="status">Opening the builder…</p>
        : !user ? <Landing onError={onError} />
          : me === null ? <p className="nb-loading" role="status">Checking your access…</p>
            : me === false ? <main className="nb-dash"><section className="nb-panel"><h2>This builder is for invited officers.</h2><p className="nb-help">You are signed in as {user.email}. Ask Mose to add this email, then reload.</p></section></main>
              : open ? <Editor key={open} id={open} me={me} onBack={() => go(null)} onError={onError} />
                : <Dashboard me={me} onOpen={go} onError={onError} />}
    </div>
  );
}
