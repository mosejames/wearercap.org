import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchNeighbors, setInterest, setPaused, splitNeighbors, areaTitle, distanceLine, firstName } from '../neighbors.js';
import { scheduleOverlap } from '../compatibility.js';
import { setFamilyRadius } from '../family.js';
import { detectPlatform, groupTextHref } from '../groupHandoff.js';

// The mutual-interest home screen (Mose, 2026-11-10). One question, one button
// per family, and a plain "what happens next". A family never learns who said
// they were interested unless they said yes too; the server enforces that,
// this view only presents it. See migration 20261111022500.

const RADIUS_CHOICES = [5, 10, 15, 25];

function matchMessage(myName) {
  const me = firstName(myName);
  const intro = me ? `Hi, this is ${me} from the RCA carpool on wearercap.` : 'Hi, this is your RCA carpool match from wearercap.';
  return `${intro} We both said we're interested. Want to talk about sharing the drive?`;
}

function emailHref(row, myName) {
  if (!row.contact_email) return null;
  const subject = encodeURIComponent('RCA carpool');
  const body = encodeURIComponent(matchMessage(myName));
  return `mailto:${row.contact_email}?subject=${subject}&body=${body}`;
}

function Steps() {
  return (
    <section className="cp-next" aria-labelledby="cp-next-title">
      <h2 className="cp-next-title" id="cp-next-title">What happens next</h2>
      <ol className="cp-next-steps">
        <li><span className="cp-next-num" aria-hidden="true">1</span><p><strong>You say you're interested.</strong> No one is told it was you.</p></li>
        <li><span className="cp-next-num" aria-hidden="true">2</span><p><strong>If they say yes too,</strong> you both get an email and see each other's name and contact.</p></li>
        <li><span className="cp-next-num" aria-hidden="true">3</span><p><strong>You plan the rides together</strong> in your own group text.</p></li>
      </ol>
    </section>
  );
}

function MatchCard({ row, family, busy, onStop }) {
  const [confirming, setConfirming] = useState(false);
  const name = row.parent_name || 'Your match';
  const first = firstName(row.parent_name) || 'them';
  const textHref = groupTextHref({
    phones: row.contact_phone ? [row.contact_phone] : [],
    message: matchMessage(family.parent_name),
    platform: detectPlatform(typeof navigator === 'undefined' ? '' : navigator.userAgent),
  });
  const mail = emailHref(row, family.parent_name);
  return (
    <article className="cp-fam cp-fam--match">
      <div className="cp-fam-head">
        <span className="cp-fam-avatar" aria-hidden="true">{name.split(/\s+/).map((w) => w[0]).join('').slice(0, 2).toUpperCase()}</span>
        <div>
          <h3 className="cp-fam-name">{name}</h3>
          <p className="cp-fam-meta">
            {row.child_names ? `Parent of ${row.child_names}` : areaTitle(row).replace('A family in ', '')}
          </p>
        </div>
      </div>
      <p className="cp-fam-overlap">{scheduleOverlap(family, row)}</p>
      {(row.contact_phone || row.contact_email) && (
        <dl className="cp-fam-contact">
          {row.contact_phone && <><dt>Phone</dt><dd><a href={`tel:${String(row.contact_phone).replace(/[^\d+]/g, '')}`}>{row.contact_phone}</a></dd></>}
          {row.contact_email && <><dt>Email</dt><dd>{row.contact_email}</dd></>}
        </dl>
      )}
      <div className="cp-fam-actions">
        {textHref && <a className="cp-btn cp-btn--primary cp-btn--block" href={textHref}>Start our group text</a>}
        {mail && <a className={`cp-btn cp-btn--block ${textHref ? 'cp-btn--ghost' : 'cp-btn--primary'}`} href={mail}>Email {first}</a>}
      </div>
      {confirming ? (
        <div className="cp-fam-confirm" role="group" aria-label={`Stop sharing with ${first}`}>
          <p>Stop sharing with {first}? You will both lose each other's contact here. Anything you already texted stays.</p>
          <div className="cp-fam-confirm-actions">
            <button type="button" className="cp-btn cp-btn--danger cp-btn--sm" disabled={busy} onClick={onStop}>
              {busy ? 'Stopping…' : 'Stop sharing'}
            </button>
            <button type="button" className="cp-btn cp-btn--quiet" onClick={() => setConfirming(false)}>Keep sharing</button>
          </div>
        </div>
      ) : (
        <button type="button" className="cp-btn cp-btn--quiet cp-fam-undo" onClick={() => setConfirming(true)}>
          Stop sharing with {first}
        </button>
      )}
    </article>
  );
}

function NearbyCard({ row, family, busy, disabled, onChange }) {
  return (
    <article className="cp-fam">
      <div>
        <h3 className="cp-fam-name">{areaTitle(row)}</h3>
        <p className="cp-fam-meta">{distanceLine(row.distance_miles)}</p>
      </div>
      <p className="cp-fam-overlap">{scheduleOverlap(family, row)}</p>
      {row.interested ? (
        <div className="cp-fam-sent">
          <p className="cp-fam-sent-badge">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M20 6 9 17l-5-5" /></svg>
            You're interested
          </p>
          <p className="cp-fam-sent-note">Thank you. We're waiting on this family to show interest too. If they do, we'll email you both. Until then, they won't know.</p>
          <button type="button" className="cp-btn cp-btn--quiet" disabled={busy || disabled} onClick={() => onChange(false)}>
            {busy ? 'Saving…' : 'Change my mind'}
          </button>
        </div>
      ) : (
        <button type="button" className="cp-btn cp-btn--primary cp-btn--block" disabled={busy || disabled} onClick={() => onChange(true)}>
          {busy ? 'Saving…' : "I'm interested"}
        </button>
      )}
    </article>
  );
}

export default function Neighbors({ family, userId, fromIntro = false, onFamilyChange }) {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busyId, setBusyId] = useState('');
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const mountedRef = useRef(true);
  const paused = !!family.paused_at;

  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  const load = useCallback(async () => {
    try {
      const data = await fetchNeighbors();
      if (!mountedRef.current) return;
      setRows(data);
      setLoadError('');
    } catch {
      if (mountedRef.current) setLoadError('We could not load families near you. Please try again.');
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load, family.radius_miles, family.paused_at]);

  async function act(key, work, message) {
    if (busyId) return;
    setBusyId(key);
    setActionError('');
    setNotice('');
    try {
      const result = await work();
      if (mountedRef.current && message) setNotice(typeof message === 'function' ? message(result) : message);
    } catch (e) {
      if (mountedRef.current) setActionError(e?.message || 'Something went wrong. Please try again.');
    } finally {
      if (mountedRef.current) setBusyId('');
      await load();
    }
  }

  const changeInterest = (row) => (interested) => act(
    row.user_id,
    () => setInterest(row.user_id, interested),
    (result) => {
      if (!interested) return 'Done. That family was never told.';
      return result?.mutual
        ? 'You both said yes. Their name and contact are now at the top of this page.'
        : 'Thank you for showing interest. Now we wait for that family to show interest too. If they do, we\'ll email you both.';
    },
  );

  const togglePause = (next) => act('pause', async () => {
    const result = await setPaused(next);
    onFamilyChange?.({ paused_at: result?.paused_at ?? (next ? new Date().toISOString() : null) });
  }, next ? 'Carpool is paused. Nobody can see you, and you can\'t see anyone. Resume anytime.' : 'Welcome back. You are visible to nearby families again.');

  const widen = (miles) => act('radius', async () => {
    await setFamilyRadius(userId, miles);
    onFamilyChange?.({ radius_miles: miles });
  }, `Now searching within ${miles} miles.`);

  const { matches, nearby } = splitNeighbors(rows);
  const nobody = !loading && !loadError && !paused && matches.length === 0 && nearby.length === 0;

  return (
    <>
      {fromIntro && !paused && (
        <div className="cp-intro-note" role="note">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><rect x="3" y="11" width="18" height="10" rx="2" /><path d="M7 11V7a5 5 0 0 1 10 0v4" /></svg>
          <p><strong>You came from an introduction.</strong> Each family below got the same note on its own. None of them know you got it.</p>
        </div>
      )}

      <div className="carpool-shell cp-neighbors">
        {notice && <p className="cp-banner cp-banner--ok" role="status">{notice}</p>}
        {actionError && <p className="cp-banner cp-banner--error" role="alert">{actionError}</p>}

        {paused && (
          <section className="cp-fam cp-fam--quiet" aria-labelledby="cp-paused-title">
            <h2 className="cp-fam-name" id="cp-paused-title">Carpool is paused.</h2>
            <p className="cp-fam-meta">Nobody nearby can see you, and you can't see anyone. Families you already matched with stay below.</p>
            <button type="button" className="cp-btn cp-btn--primary cp-btn--block" disabled={busyId === 'pause'} onClick={() => togglePause(false)}>
              {busyId === 'pause' ? 'Resuming…' : 'Resume carpool'}
            </button>
          </section>
        )}

        {loading && <p className="cp-loading">Finding families near you</p>}
        {loadError && (
          <p role="alert">{loadError}{' '}
            <button type="button" className="cp-btn cp-btn--quiet" onClick={() => { setLoading(true); load(); }}>Try again</button>
          </p>
        )}

        {matches.length > 0 && (
          <section className="cp-fam-list" aria-labelledby="cp-matches-title">
            <h2 className="cp-section-label" id="cp-matches-title">You both said yes</h2>
            {matches.map((row) => (
              <MatchCard key={row.user_id} row={row} family={family} busy={busyId === row.user_id}
                onStop={() => act(row.user_id, () => setInterest(row.user_id, false), 'You stopped sharing. Your contact is no longer shown to that family here.')} />
            ))}
            <ul className="cp-checklist cp-first-ride">
              <li>Meet or talk first. Take time to get to know each other.</li>
              <li>Settle who drives which days.</li>
              <li>Agree on a backup plan for a day someone can't drive.</li>
            </ul>
            <p className="cp-quote">We're glad to make the introduction. The rest is yours.</p>
          </section>
        )}

        {nearby.length > 0 && (
          <section className="cp-fam-list" aria-labelledby="cp-nearby-title">
            <h2 className="cp-section-label" id="cp-nearby-title">
              {matches.length > 0 ? 'More families near you' : 'Families near you'}
            </h2>
            {nearby.map((row) => (
              <NearbyCard key={row.user_id} row={row} family={family}
                busy={busyId === row.user_id} disabled={!!busyId && busyId !== row.user_id}
                onChange={changeInterest(row)} />
            ))}
          </section>
        )}

        {nobody && (
          <section className="cp-fam-list" aria-labelledby="cp-nobody-title">
            <article className="cp-fam">
              <h2 className="cp-fam-name" id="cp-nobody-title">No families near you yet</h2>
              <p className="cp-fam-meta">Families sign up all year. When a new family joins near you, we'll email you. There's nothing else you need to do.</p>
            </article>
            <article className="cp-fam">
              <h3 className="cp-fam-name">Look a little farther</h3>
              <p className="cp-fam-meta">A family a few more miles out may still share part of your drive.</p>
              <div className="cp-radius-pills" role="group" aria-label="Search within">
                {RADIUS_CHOICES.map((miles) => (
                  <button key={miles} type="button"
                    className={`cp-pill${family.radius_miles === miles ? ' cp-pill--on' : ''}`}
                    aria-pressed={family.radius_miles === miles}
                    disabled={busyId === 'radius'}
                    onClick={() => widen(miles)}>
                    {miles} mi
                  </button>
                ))}
              </div>
            </article>
            <article className="cp-fam cp-fam--warm">
              <h3 className="cp-fam-name">Know an RCA family near you?</h3>
              <p className="cp-fam-meta">Share wearercap.org/carpool with them. It only takes a few minutes to join.</p>
            </article>
          </section>
        )}

        {!paused && !loading && <Steps />}

        <p className="cp-fine cp-neighbors-foot">
          Your address is never shared. Saying you're interested stays private unless the other family says yes too.{' '}
          <a href="#sharing">How privacy works</a>
        </p>
        {!paused && (
          <p className="cp-fine cp-neighbors-foot">
            Not looking right now?{' '}
            <button type="button" className="cp-linkbtn" disabled={busyId === 'pause'} onClick={() => togglePause(true)}>Pause carpool</button>.
            You'll keep your details and can come back anytime.
          </p>
        )}
      </div>
    </>
  );
}
