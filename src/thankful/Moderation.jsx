import React, { useEffect, useState } from 'react';
import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.VITE_SUPABASE_URL;
const key = import.meta.env.VITE_SUPABASE_ANON_KEY;
const client = url && key ? createClient(url, key) : null;

const buckets = { photo: 'thankful-message-photos', video: 'thankful-at-rca' };

async function loadPreviews(items) {
  const batches = await Promise.allSettled(Object.entries(buckets).map(async ([kind, bucket]) => {
    const paths = items.filter(item => item.kind === kind).map(item => item.path);
    if (!paths.length) return [];
    const { data, error } = await client.storage.from(bucket).createSignedUrls(paths, 900);
    if (error) throw error;
    return data.filter(item => item.signedUrl).map(item => [item.path, item.signedUrl]);
  }));
  return Object.fromEntries(batches.flatMap(batch => batch.status === 'fulfilled' ? batch.value : []));
}

function SignIn({ onError }) {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [code, setCode] = useState('');
  return <form className="moderation-login" onSubmit={async event => {
    event.preventDefault();
    setBusy(true);
    onError('');
    try {
      const { error } = code.trim()
        ? await client.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' })
        : await client.auth.signInWithOtp({
          email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: location.origin + '/thankful/?moderate=1' },
        });
      if (error) throw error;
      setSent(true);
    } catch { onError(code ? 'That code didn’t work. Check your email and try again.' : 'The sign-in email couldn’t be sent. Check your RCAP administrator email and try again.'); }
    finally { setBusy(false); }
  }}>
    <label>Email<input autoComplete="email" type="email" required value={email} onChange={event => setEmail(event.target.value)}/></label>
    {sent && <>
      <p role="status">Open the link in your email or enter the code below if one was provided.</p>
      <label>Sign-in code<input autoComplete="one-time-code" inputMode="numeric" value={code} onChange={event => setCode(event.target.value)}/></label>
    </>}
    <button className="button" disabled={busy || !client}>{code ? 'Verify code' : sent ? 'Resend sign-in email' : 'Email me a sign-in link'}</button>
  </form>;
}

export default function Moderation() {
  const [session, setSession] = useState(undefined);
  const [items, setItems] = useState(null);
  const [denied, setDenied] = useState(false);
  const [filter, setFilter] = useState('pending');
  const [previews, setPreviews] = useState({});
  function clearPreview(path) {
    setPreviews(current => ({ ...current, [path]: undefined }));
  }
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!client) { setSession(null); return; }
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => setSession(nextSession));
    return () => subscription.unsubscribe();
  }, []);

  async function load(before) {
    const { data, error: loadError } = await client.rpc('thankful_moderation_queue', { before_time: before ?? null });
    if (loadError) throw loadError;
    const urls = await loadPreviews(data);
    setPreviews(previous => ({ ...previous, ...urls }));
    setItems(previous => before ? [...previous, ...data] : data);
    setMore(data.length === 40);
  }

  const [more, setMore] = useState(false);
  useEffect(() => {
    let active = true;
    setItems(null);
    setDenied(false);
    setPreviews({});
    if (session) client.rpc('thankful_moderation_queue', { before_time: null }).then(async ({ data, error: loadError }) => {
      if (!active) return;
      if (loadError) {
        if (loadError.code === '42501') setDenied(true);
        else setError('The review queue couldn’t load.');
      } else {
        const urls = await loadPreviews(data);
        if (!active) return;
        setPreviews(urls);
        setItems(data);
        setMore(data.length === 40);
      }
    });
    return () => { active = false; };
  }, [session?.user.id]);

  async function act(item, action) {
    setBusy(item.path);
    setError('');
    setNotice('');
    try {
      if (action === 'preview') {
        const { data, error: previewError } = await client.storage
          .from(buckets[item.kind]).createSignedUrl(item.path, 900);
        if (previewError) throw previewError;
        setPreviews(current => ({ ...current, [item.path]: data.signedUrl }));
      } else {
        const needsPermission = !item.published && item.kind === 'video' && !item.gallery_consent;
        const confirmed = needsPermission && window.confirm('Confirm you have permission to publish this clip in the public Gratitude gallery.');
        if (needsPermission && !confirmed) return;
        const { error: updateError } = await client.rpc('thankful_set_published', {
          media_kind: item.kind, media_path: item.path, make_public: !item.published, gallery_permission_confirmed: confirmed,
        });
        if (updateError) throw updateError;
        setItems(current => current.map(entry => entry.path === item.path ? { ...entry, published: !item.published } : entry));
        setNotice(item.published ? 'Submission hidden from the gallery.' : 'Submission published to the gallery.');
      }
    } catch { setError('That action didn’t go through. Refresh and try again.'); }
    finally { setBusy(null); }
  }

  const visible = items?.filter(item => filter === 'all' || item.published === (filter === 'published'));
  return <main className="finishing gallery-page moderation">
    <header className="moderation-header"><div><a className="text-link" href="/thankful/">← Thankful at RCA</a>
      <h1>Moderate submissions</h1></div>
      {session && <button className="text-link" disabled={busy !== null} onClick={() => { setError(''); setNotice(''); void client.auth.signOut(); }}>Sign out</button>}
    </header>
    {session === undefined && <p role="status">Checking your sign-in…</p>}
    {session === null && <SignIn onError={setError}/>}
    {denied && <p role="alert">This account doesn’t have access to moderate Thankful at RCA.</p>}
    {session && !denied && !items && !error && <p role="status">Loading submissions…</p>}
    {items && <>
      <nav className="moderation-filters" aria-label="Filter submissions">
        {['pending', 'published', 'all'].map(value => <button type="button" key={value} className="button"
          aria-pressed={filter === value} onClick={() => setFilter(value)}>{value}</button>)}
      </nav>
      {!visible.length && <p>No {filter === 'all' ? '' : filter + ' '}submissions on this page.</p>}
      <div className="moderation-grid">{visible.map(item => <article className="moderation-card" key={item.path}>
        <p className="hint">{item.kind === 'photo' ? 'Photo card' : 'Video'} · {item.published ? 'Published' : 'Pending'} · {new Date(item.created_at).toLocaleDateString()}</p>
        <h2>{item.author || 'Submission'}</h2>
        <p>{[item.prompt, item.family_name].filter(Boolean).join(' · ')}</p>
        <p className="hint">{[item.houses, item.class_years].filter(Array.isArray).flat().filter(value => typeof value === 'string').join(' · ')}</p>
        {item.message && <p>{item.message}</p>}
        {previews[item.path] && (item.kind === 'photo'
          ? <img className="moderation-preview" src={previews[item.path]} alt="Submitted gratitude photo" onError={() => clearPreview(item.path)}/>
          : <video className="moderation-preview" src={previews[item.path] + '#t=0.001'} controls playsInline preload="metadata" onError={() => clearPreview(item.path)}/>)}
        <div className="moderation-actions">
          {!previews[item.path] && <button className="text-link" disabled={busy !== null}
            onClick={() => act(item, 'preview')}>Retry preview</button>}
          <button className="button" disabled={busy !== null || (!item.published && !previews[item.path])}
            onClick={() => act(item, 'publish')}>{item.published ? 'Hide' : 'Publish'}</button>
        </div>
      </article>)}</div>
      {more && <button className="text-link" disabled={busy !== null} onClick={async () => {
        setBusy('page');
        try { await load(items.at(-1).created_at); } catch { setError('Couldn’t load more submissions.'); }
        finally { setBusy(null); }
      }}>Load more submissions</button>}
    </>}
    {error && <p className="error" role="alert">{error}</p>}
    {notice && <p role="status">{notice}</p>}
  </main>;
}
