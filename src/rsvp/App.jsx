import { useCallback, useEffect, useMemo, useState } from 'react';
import { CalendarDays, MapPin, Users, Pencil, Share2 } from 'lucide-react';
import * as api from './api.js';
import {
  countLine, eventWhen, eyebrowDate, mapsUrl, slugFromPath, mergeWall, mergeThread,
  emptyForm, fromMine, wallName,
} from './model.js';
import { Chip } from './views/Chip.jsx';
import Sheet from './views/Sheet.jsx';
import Done from './views/Done.jsx';
import { ThreadList, Composer } from './views/Thread.jsx';
import Admin from './views/Admin.jsx';

/* /rsvp/<slug>. The next event is a row in public.events, not a new page.
   Only the hero art is per event, keyed by slug below; an event without art
   gets the plain navy band. */
const ART = {
  'karaoke-sept-27': { image: '/images/rsvp-karaoke-mic.jpg', kicker: 'PARENT SOCIAL', title: ['PARENT', 'SOCIAL'], sub: 'R&B KARAOKE' },
};

const DEFAULT_SLUG = 'karaoke-sept-27';

// Opens the phone's own share sheet, so a parent lands in Messages, WhatsApp,
// GroupMe or wherever they already talk to other RCA parents. Desktop browsers
// mostly lack navigator.share, so there it falls back to copying the link and
// says so, rather than showing a button that does nothing.
function ShareButton({ event }) {
  const [copied, setCopied] = useState(false);

  const url = typeof window !== 'undefined' ? window.location.href : '';
  const text = `${event.title} — Sunday, September 27, 5 to 7 PM at Ron Clark Academy. Come sing with us.`;

  async function share() {
    if (navigator.share) {
      try {
        await navigator.share({ title: event.title, text, url });
        return;
      } catch (err) {
        // The person closed the sheet. Not an error worth surfacing.
        if (err && err.name === 'AbortError') return;
      }
    }
    try {
      await navigator.clipboard.writeText(`${text} ${url}`);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2400);
    } catch (err) {
      /* nothing sensible left to try */
    }
  }

  return (
    <button className="rv-share" type="button" onClick={share}>
      <Share2 size={18} aria-hidden="true" />
      {copied ? 'Link copied' : 'Share with an RCA friend'}
    </button>
  );
}

export default function App() {
  const slug = slugFromPath(window.location.pathname) || DEFAULT_SLUG;
  const [hash, setHash] = useState(window.location.hash);
  useEffect(() => {
    const f = () => setHash(window.location.hash);
    window.addEventListener('hashchange', f);
    return () => window.removeEventListener('hashchange', f);
  }, []);
  if (hash === '#admin') return <Admin slug={slug} />;
  return <EventPage slug={slug} />;
}

function EventPage({ slug }) {
  const [event, setEvent] = useState(null);
  const [missing, setMissing] = useState(false);
  const [wall, setWall] = useState([]);
  const [thread, setThread] = useState([]);
  const [token, setToken] = useState(() => api.adoptTokenFromUrl(slug));
  const [mine, setMine] = useState(null);
  const [sheet, setSheet] = useState(null); // null | 'form' | 'done'
  const [photoNote, setPhotoNote] = useState('');
  const [fresh, setFresh] = useState(() => new Set());

  const refresh = useCallback(async () => {
    try {
      const [ev, w, t] = await Promise.all([api.loadEvent(slug), api.loadWall(slug), api.loadThread(slug, api.getToken(slug))]);
      if (!ev) { setMissing(true); return; }
      setEvent(ev);
      setWall(w);
      setThread(t);
    } catch (e) {
      console.warn('load failed', e);
    }
  }, [slug]);

  const refreshMine = useCallback(async (t = token) => {
    if (!api.isToken(t)) { setMine(null); return; }
    try {
      const m = await api.loadMine(slug, t);
      if (!m) { api.clearToken(slug); setToken(null); }
      setMine(m);
    } catch (e) {
      console.warn('rsvp load failed', e);
    }
  }, [slug, token]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => { refreshMine(); }, [refreshMine]);

  // The room filling up, live. Polling behind it for phones that dropped the
  // socket while locked.
  useEffect(() => {
    const off = api.subscribe(slug, {
      onRsvp: (row) => {
        setWall((w) => {
          if (!w.some((x) => x.id === row.id)) setFresh((f) => new Set(f).add(row.id));
          return mergeWall(w, row);
        });
        if (typeof row.going_count === 'number') setEvent((e) => (e ? { ...e, going_count: row.going_count } : e));
      },
      onComment: (row) => setThread((t) => mergeThread(t, row)),
    });
    const onVisible = () => document.visibilityState === 'visible' && refresh();
    document.addEventListener('visibilitychange', onVisible);
    const poll = setInterval(refresh, 60000);
    return () => { off(); clearInterval(poll); document.removeEventListener('visibilitychange', onVisible); };
  }, [slug, refresh]);

  const going = !!(mine && mine.status === 'going');
  const art = ART[slug] || { kicker: 'RCAP EVENT', title: [event ? event.title : ''], sub: '' };
  const when = event ? eventWhen(event) : null;
  const calendarUrl = `/rsvp/${slug}/calendar.ics`;

  const myChip = useMemo(() => {
    if (!mine) return null;
    return wall.find((w) => w.id === mine.id) || {
      id: mine.id, wall_name: mine.wall_name, house: mine.house, has_plus_one: !!mine.plus_one_name, photo_url: mine.photo_url,
    };
  }, [mine, wall]);

  async function submit(payload, photoBlob) {
    const isNew = !going;
    const t = await api.rsvp(slug, token, payload);
    api.setToken(slug, t);
    setToken(t);
    let note = '';
    if (photoBlob) {
      try {
        await api.uploadPhoto(t, photoBlob);
      } catch (e) {
        console.warn('photo failed', e);
        note = 'You are in, but the photo did not upload. Try it again from Change or cancel.';
      }
    }
    // After the photo, so the board alert can carry it.
    if (isNew) api.sendConfirmation(t);
    setPhotoNote(note);
    await Promise.all([refreshMine(t), refresh()]);
    setSheet(isNew ? 'done' : null);
  }

  async function cancelRsvp() {
    await api.cancel(token);
    await Promise.all([refreshMine(), refresh()]);
    setSheet(null);
  }

  async function post(body, prompt) {
    const id = await api.comment(token, body, prompt);
    api.notifyComment(token, id);
    setThread(await api.loadThread(slug, api.getToken(slug)));
  }

  const openForm = () => setSheet('form');

  if (missing) {
    return (
      <main className="rv-missing">
        <p className="rv-lockup-sm">WE ARE RCA<b>P</b>.</p>
        <h1>That event is not here.</h1>
        <p><a href="/">Back to wearercap.org</a></p>
      </main>
    );
  }

  return (
    <div className={`rv-page${going ? ' is-going' : ''}`}>
      <header className="rv-lockup">
        <a href="/" className="rv-lockup-mark" aria-label="wearercap.org home">
          <span>WE</span><span>ARE</span><span>RCA<b>P</b><i>.</i></span>
        </a>
        <p className="rv-lockup-side">RON CLARK<br />ACADEMY<br />PARENTS</p>
      </header>

      <section className="rv-band" style={art.image ? { '--art': `url(${art.image})` } : undefined}>
        <div className="rv-band-inner">
          <p className="rv-eyebrow">{art.kicker}{event ? ` · ${eyebrowDate(event)}` : ''}</p>
          <h1 className="rv-title">
            {art.title.map((line, i) => <span key={i} className={i === 1 ? 'gold' : ''}>{line}</span>)}
          </h1>
          {art.sub && <p className="rv-sub"><span>{art.sub}</span></p>}
          {when && (
            <p className="rv-when">
              <b>{when.day}</b>
              <span>{when.time}</span>
              <span>at {event.venue_name}</span>
            </p>
          )}
        </div>
      </section>

      <section className="rv-status" id="rv-count" aria-live="polite">
        {going ? (
          <div className="rv-status-in">
            <p className="rv-count">You're in{mine ? `, ${wallName(mine.full_name).split(' ')[0]}` : ''}.</p>
            <p className="rv-count-sub">{countLine(event ? event.going_count : 0)}</p>
            <div className="rv-status-actions">
              <a className="rv-ghost on-dark" href={calendarUrl}><CalendarDays size={16} /> Add to calendar</a>
              <button className="rv-ghost on-dark" onClick={openForm}><Pencil size={15} /> Change or cancel</button>
            </div>
          </div>
        ) : (
          <>
            <p className="rv-count">{event ? countLine(event.going_count) : ' '}</p>
            <button className="rv-cta" onClick={openForm} disabled={!event || event.status !== 'open'}>
              {event && event.status !== 'open' ? 'RSVPs are closed' : "I'm in"}
            </button>
          </>
        )}
      </section>

      <main className="rv-main">
        <section className="rv-section">
          <h2 className="rv-h">Who's coming</h2>
          {wall.length ? (
            <ul className="rv-wall">
              {wall.map((p, i) => (
                <Chip key={p.id} person={p} index={fresh.has(p.id) ? 0 : i} you={mine && p.id === mine.id} />
              ))}
            </ul>
          ) : (
            <p className="rv-empty">{event ? 'The wall is empty. Your name could be first.' : 'Loading the wall.'}</p>
          )}
        </section>

        {event && (
          <section className="rv-section rv-details">
            <ul>
              <li><CalendarDays size={20} /><span><b>{when.day}</b><br />{when.time}</span></li>
              <li><MapPin size={20} /><span><b>{event.venue_name}</b><br /><a href={mapsUrl(event)} target="_blank" rel="noreferrer">{event.venue_address}</a></span></li>
              <li><Users size={20} /><span><b>RCA parents</b><br />Adults only. Leave the kids with someone who loves them.</span></li>
            </ul>
            {event.blurb && <p className="rv-blurb">{event.blurb}</p>}
            <ShareButton event={event} />
          </section>
        )}

        <section className="rv-section">
          <h2 className="rv-h">The thread</h2>
          <p className="rv-thread-sub">A few questions from back in the day. Answer one, then read the room.</p>
          {event && event.comments_open ? (
            <Composer locked={!going} onPost={post} onLockedClick={openForm} />
          ) : (
            event && <p className="rv-lock">The thread is closed.</p>
          )}
          <ThreadList
            thread={[...thread].reverse()}
            canReact={going}
            onReact={async (commentId, emoji) => {
              await api.reactToComment(api.getToken(slug), commentId, emoji);
              setThread(await api.loadThread(slug, api.getToken(slug)));
            }}
            onLockedClick={openForm}
          />
        </section>
      </main>

      <footer className="rv-footer">
        <p className="rv-lockup-sm">WE ARE RCA<b>P</b>.</p>
        <p>Organized by parent volunteers. Not sponsored by or affiliated with Ron Clark Academy.</p>
        <p><a href="/">wearercap.org</a></p>
      </footer>

      <div className="rv-dock">
        {!going && event && event.status === 'open' && (
          <button className="rv-cta rv-cta-block" onClick={openForm}>I'm in</button>
        )}
      </div>

      {sheet === 'form' && event && (
        <Sheet
          event={event}
          mine={mine}
          initial={mine ? fromMine(mine) : emptyForm()}
          onSubmit={submit}
          onCancelRsvp={cancelRsvp}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === 'done' && myChip && (
        <Done
          person={myChip}
          calendarUrl={calendarUrl}
          link={api.privateLink(slug, token)}
          photoNote={photoNote}
          onEdit={() => setSheet('form')}
          onClose={() => setSheet(null)}
        />
      )}
    </div>
  );
}
