import { useEffect, useState } from 'react';
import { RCA_HOUSES, rcaHouse, plural } from './config.js';
import { houseBoard, mostLoved, mediaUrl } from './data.js';
import { isVideo } from './videos.js';

// Both widgets poll, because the point of a school-wide vault is watching the
// count move while families add photos the night of the event. `version`
// refreshes them immediately when this page already knows something changed.
const POLL_MS = 45_000;

function usePolled(load, deps) {
  const [data, setData] = useState(undefined);
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    let live = true;
    const run = () => load().then((d) => { if (live) { setData(d); setFailed(false); } }).catch(() => { if (live) setFailed(true); });
    run();
    const t = setInterval(run, POLL_MS);
    return () => { live = false; clearInterval(t); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
  return { data, failed };
}

export function HouseBoard({ eventId = null, version, title, sub }) {
  const { data, failed } = usePolled(() => houseBoard(eventId), [eventId, version]);
  const rows = data || RCA_HOUSES.map((h) => ({ house: h.id, photos: 0, families: 0 }));
  const top = Math.max(0, ...rows.map((r) => r.photos));
  const leaders = rows.filter((r) => top > 0 && r.photos === top);
  return (
    <div className="house-board">
      <div className="school-head">
        <span className="eyebrow">{title}</span>
        <p className="school-sub">
          {!data ? (failed ? 'The leaderboard could not load.' : 'Counting…')
            : top === 0 ? 'No photos yet. The first house on the board takes the lead.'
            : leaders.length > 1 ? `Tied at the top: ${leaders.map((r) => rcaHouse(r.house)?.name).join(' and ')}.`
            : `${rcaHouse(leaders[0].house)?.name} leads. ${sub || ''}`}
        </p>
      </div>
      <ol className="house-rows">
        {rows.map((r) => {
          const h = rcaHouse(r.house) || { name: r.house, color: '#1a1613', meaning: '' };
          const lead = top > 0 && r.photos === top;
          return (
            <li key={r.house} className={`house-row${lead ? ' lead' : ''}`} style={{ '--house': h.color }}>
              <div className="house-row-label">
                <b>{h.name}</b>
                <span>{plural(r.photos, 'photo')}<i> · {plural(r.families, 'family', 'families')}</i></span>
              </div>
              <div className="house-bar" aria-hidden="true">
                <span style={{ width: top ? `${Math.max(r.photos ? 3 : 0, (r.photos / top) * 100)}%` : '0%' }} />
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export function MostLoved({ eventId = null, version, events = [], title, onOpen, hideEmpty = false }) {
  const { data: photo, failed } = usePolled(() => mostLoved(eventId), [eventId, version]);
  // On an event page an empty card is just distance between the button and the photos.
  if (hideEmpty && !photo) return null;
  const event = photo ? events.find((e) => e.id === photo.eventId) : null;
  const href = photo && event ? `#/e/${event.slug}/p/${photo.id}` : null;
  const house = photo ? rcaHouse(photo.rcaHouse) : null;
  const open = (ev) => { if (onOpen && photo) { ev.preventDefault(); onOpen(photo.id); } };
  return (
    <div className={`most-loved${photo ? '' : ' empty-loved'}`}>
      <div className="school-head">
        <span className="eyebrow">{title}</span>
        <p className="school-sub">
          {photo ? <>{plural(photo.likes, 'heart')} and counting. Love a different one and it can take the spot.</>
            : failed ? 'The most loved photo could not load.'
            : photo === undefined ? 'Loading…' : 'Nothing has a heart yet. Tap the heart on your favorite and it lands here.'}
        </p>
      </div>
      {photo && (
        <a className="most-loved-card" href={href || '#/top'} onClick={open}>
          <img src={mediaUrl(photo, isVideo(photo) ? 'thumb' : 'web')} alt={photo.caption || `Most loved photo${event ? ` from ${event.title}` : ''}`} loading="lazy" />
          <span className="most-loved-meta">
            <b>♥ {photo.likes}</b>
            <span>{photo.uploaderName || 'An RCA family'}{house ? <i style={{ '--house': house.color }}> · {house.name}</i> : null}{event && !eventId ? ` · ${event.title}` : ''}</span>
          </span>
        </a>
      )}
    </div>
  );
}
