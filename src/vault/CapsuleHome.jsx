import { useEffect, useState } from 'react';
import { WORDS, fmtDate, fmtRange, acceptsUploads, plural } from './config.js';
import { listTopPhotos, latestComments, mediaUrl } from './data.js';
import { HouseBoard } from './School.jsx';
import { isVideo } from './videos.js';

/* The Capsule home. It used to open straight into the newest album, which
   made the whole Capsule look like Bingo Night. It now reads like a front
   page: what is next, what just happened, what people are saying, what they
   love, and then every album. Everything here comes from data the gallery
   already shows, so nothing on this page is a new way to see a photo. */

const POLL_MS = 45_000;

function usePolled(load, deps) {
  const [data, setData] = useState(undefined);
  useEffect(() => {
    let live = true;
    const run = () => load().then((d) => { if (live) setData(d); }).catch(() => { if (live) setData((d) => d ?? null); });
    run();
    const t = setInterval(run, POLL_MS);
    return () => { live = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return data;
}

const dayDiff = (from, to) =>
  Math.round((new Date(`${to}T12:00:00`) - new Date(`${from}T12:00:00`)) / 86_400_000);

export const whenLabel = (startsOn, today) => {
  const n = dayDiff(today, startsOn);
  if (n <= 0) return 'Today';
  if (n === 1) return 'Tomorrow';
  if (n < 7) return fmtDate(startsOn, { weekday: 'long' });
  return `In ${n} days`;
};

export const ago = (iso, now = Date.now()) => {
  const s = Math.max(0, (now - new Date(iso).getTime()) / 1000);
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 7 * 86_400) return `${Math.floor(s / 86_400)}d ago`;
  return fmtDate(iso);
};

// Which dated event is next, and which one happened most recently. An event
// that is on today counts as the latest, because today is when the photos
// start coming in.
export function pickEvents(events, today) {
  const dated = events.filter((e) => !e.hidden && !e.ongoing && e.kind !== 'everyday');
  const next = dated.filter((e) => e.startsOn > today).sort((a, b) => a.startsOn.localeCompare(b.startsOn))[0] || null;
  const latest = dated.filter((e) => e.startsOn <= today).sort((a, b) => b.startsOn.localeCompare(a.startsOn))[0] || null;
  const everyday = events.find((e) => !e.hidden && e.kind === 'everyday') || null;
  const albums = events.filter((e) => !e.hidden && (e.kind === 'everyday' || e.ongoing || e.startsOn <= today))
    .sort((a, b) => {
      if (a.kind === 'everyday') return 1;
      if (b.kind === 'everyday') return -1;
      return b.startsOn.localeCompare(a.startsOn);
    });
  return { next, latest, everyday, albums };
}

function Cover({ photos, className = '' }) {
  const n = Math.min(photos.length, 4);
  return (
    <div className={`cap-cover n${n} ${className}`}>
      {n ? photos.slice(0, 4).map((p) => <img key={p.id} src={mediaUrl(p, 'thumb')} alt="" loading="lazy" />)
        : <span className="cap-cover-empty" aria-hidden="true" />}
    </div>
  );
}

function NextEvent({ event, today }) {
  if (!event) {
    return (
      <article className="cap-card cap-next is-empty">
        <p className="cap-eyebrow">Next event</p>
        <h2>Coming soon</h2>
        <p className="cap-body">The next event shows up here as soon as it is on the calendar. Its album opens that morning.</p>
        <a className="cap-link" href="/">See what is happening →</a>
      </article>
    );
  }
  const d = new Date(`${event.startsOn}T12:00:00`);
  return (
    <article className="cap-card cap-next">
      <p className="cap-eyebrow">Next event · {whenLabel(event.startsOn, today)}</p>
      <div className="cap-next-row">
        <div className="cap-date" aria-hidden="true">
          <small>{d.toLocaleDateString('en-US', { month: 'short' })}</small>
          <b>{d.getDate()}</b>
          <small>{d.toLocaleDateString('en-US', { weekday: 'short' })}</small>
        </div>
        <div>
          <h2>{event.title}</h2>
          {event.blurb && <p className="cap-body">{event.blurb}</p>}
          <p className="cap-fine">Photos open {fmtDate(event.startsOn, { weekday: 'long', month: 'long', day: 'numeric' })}.</p>
        </div>
      </div>
    </article>
  );
}

function LatestEvent({ event, covers, today, onAdd }) {
  if (!event) return null;
  const thumbs = covers.get(event.id) || [];
  const isToday = event.startsOn === today || (event.endsOn && event.endsOn >= today);
  return (
    <article className="cap-card cap-latest">
      <a className="cap-latest-cover" href={`#/e/${event.slug}`} aria-label={`Open the ${event.title} album`}>
        <Cover photos={thumbs} />
        {thumbs.some(isVideo) && <span className="video-badge">▶ Includes video</span>}
      </a>
      <div className="cap-latest-body">
        <p className="cap-eyebrow">{isToday ? 'Happening today' : 'Latest event'} · {fmtRange(event.startsOn, event.endsOn)}</p>
        <h2>{event.title}</h2>
        <p className="cap-body">
          {event.photoCount
            ? <>{plural(event.photoCount, 'photo')} from {plural(event.contributorCount, 'family', 'families')}. Were you there? Add yours.</>
            : isToday ? 'The album is open. Be the first to add a photo.' : 'Were you there? Be the first to add a photo.'}
        </p>
        <div className="cap-actions">
          {acceptsUploads(event, today) && <button className="btn primary" onClick={() => onAdd(event)}>+ Add photos</button>}
          <a className="cap-link" href={`#/e/${event.slug}`}>View album →</a>
        </div>
      </div>
    </article>
  );
}

function MostLiked({ version, events }) {
  const slug = (id) => events.find((e) => e.id === id)?.slug;
  const top = usePolled(() => listTopPhotos(6), [version]);
  const list = (top || []).filter((p) => !p.hidden && !p.removedAt && p.likes > 0);
  return (
    <section className="cap-section" aria-labelledby="cap-liked">
      <div className="cap-head">
        <h2 id="cap-liked">Most liked</h2>
        {list.length > 0 && <a className="cap-link" href="#/top">See all →</a>}
      </div>
      {top === undefined ? <p className="cap-fine" role="status">Loading…</p>
        : !list.length ? <p className="cap-empty">Nothing has a heart yet. Tap the heart on your favorite and it lands here.</p>
        : <ol className="cap-liked">
          {list.map((p, i) => (
            <li key={p.id} className={i === 0 ? 'first' : ''}>
              <a href={slug(p.eventId) ? `#/e/${slug(p.eventId)}/p/${p.id}` : '#/top'} aria-label={`${plural(p.likes, 'heart')}, shared by ${p.uploaderName || WORDS.family}`}>
                <img src={mediaUrl(p, i === 0 && !isVideo(p) ? 'web' : 'thumb')} alt="" loading="lazy" />
                <span className="cap-heart">♥ {p.likes}</span>
                {isVideo(p) && <span className="cap-play" aria-hidden="true">▶</span>}
              </a>
            </li>
          ))}
        </ol>}
    </section>
  );
}

function LatestComments() {
  const rows = usePolled(() => latestComments(5), []);
  return (
    <section className="cap-section" aria-labelledby="cap-comments">
      <div className="cap-head"><h2 id="cap-comments">Latest comments</h2></div>
      {rows === undefined ? <p className="cap-fine" role="status">Loading…</p>
        : !rows?.length ? <p className="cap-empty">No comments yet. Open any photo and say something nice. It shows up here.</p>
        : <ul className="cap-comments">
          {rows.map((c) => (
            <li key={c.id}>
              <a href={`#/e/${c.eventSlug}/p/${c.photoId}`}>
                <img src={mediaUrl(c, 'thumb')} alt="" loading="lazy" />
                <span className="cap-comment">
                  <span className="cap-comment-body">“{c.body}”</span>
                  <small><b>{c.authorName || WORDS.family}</b> · {c.eventTitle} · {ago(c.createdAt)}</small>
                </span>
              </a>
            </li>
          ))}
        </ul>}
    </section>
  );
}

function Everyday({ event, covers, onAdd }) {
  if (!event) return null;
  const thumbs = covers.get(event.id) || [];
  return (
    <section className="cap-everyday" aria-labelledby="cap-everyday">
      <div>
        <p className="cap-eyebrow">No event needed</p>
        <h2 id="cap-everyday">{event.title}</h2>
        <p>Pickup line. A Saturday game. Parents being parents. The everyday moments belong in the Capsule, too.</p>
        <div className="cap-actions">
          <button className="btn gold" onClick={() => onAdd(event)}>+ Add everyday photos</button>
          {event.photoCount > 0 && <a className="cap-link light" href={`#/e/${event.slug}`}>View {plural(event.photoCount, 'photo')} →</a>}
        </div>
      </div>
      {thumbs.length > 0 && <a className="cap-everyday-cover" href={`#/e/${event.slug}`} aria-label={`Open ${event.title}`}><Cover photos={thumbs} /></a>}
    </section>
  );
}

function Albums({ albums, covers, today }) {
  return (
    <section className="cap-section" aria-labelledby="cap-albums">
      <div className="cap-head"><h2 id="cap-albums">Every album</h2></div>
      <div className="cap-albums">
        {albums.map((e) => (
          <a key={e.id} className="cap-album" href={`#/e/${e.slug}`}>
            <Cover photos={covers.get(e.id) || []} />
            <span className="cap-album-meta">
              <small>{e.kind === 'everyday' || e.ongoing ? 'All year' : fmtRange(e.startsOn, e.endsOn)}</small>
              <b>{e.title}</b>
              <small>{e.photoCount ? plural(e.photoCount, 'photo') : e.startsOn === today ? 'Open today' : 'Waiting for photos'}</small>
            </span>
          </a>
        ))}
      </div>
    </section>
  );
}

export function CapsuleHome({ events, covers, totals, today, onAdd }) {
  const { next, latest, everyday, albums } = pickEvents(events, today);
  if (!totals) return <main className="shell page"><p role="status">Loading the Capsule…</p></main>;
  return (
    <main className="capsule-home">
      <section className="cap-hero">
        <div className="shell">
          <p className="cap-eyebrow">{WORDS.homeEyebrow}</p>
          <h1>Our year, all together.</h1>
          <p className="cap-lede">Every RCA event, every family, every photo. {plural(totals.photos, 'memory', 'memories')} shared so far.</p>
        </div>
      </section>
      <div className="shell cap-grid">
        <div className="cap-events">
          <LatestEvent event={latest} covers={covers} today={today} onAdd={onAdd} />
          <NextEvent event={next} today={today} />
        </div>
        <div className="cap-pulse">
          <MostLiked version={totals.likes} events={events} />
          <LatestComments />
        </div>
        <Everyday event={everyday} covers={covers} onAdd={onAdd} />
        <Albums albums={albums} covers={covers} today={today} />
        <section className="cap-section cap-race">
          <HouseBoard version={totals.photos} title="The house race" sub="Photos added this year, by house. Live." />
        </section>
      </div>
    </main>
  );
}
