import { useEffect, useState } from 'react';
import Brand from '../../components/Brand.jsx';
import * as api from '../api.js';
import Playlist from './Playlist.jsx';
import { SPOTIFY_PLAYLIST_URL } from '../playlist-config.js';

export default function PlaylistPage() {
  const slug = 'karaoke-sept-27';
  const [token] = useState(() => api.adoptTokenFromUrl(slug));
  const [event, setEvent] = useState(null);
  const [mine, setMine] = useState(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    document.title = 'The Parent Playlist | RCAP';
    let active = true;
    setFailed(false);
    Promise.all([api.loadEvent(slug), api.loadMine(slug, token)])
      .then(([ev, parent]) => { if (active) { setEvent(ev); setMine(parent); if (!ev) setFailed(true); } })
      .catch(() => { if (active) setFailed(true); });
    return () => { active = false; };
  }, [token, attempt]);
  return <div className="rv-playlist-page">
    <header className="rv-lockup"><a href="/" aria-label="wearercap.org home"><Brand weAre width={200} /></a></header>
    <main className="rv-main">
      <a className="rv-back" href="/karaoke">← Back to karaoke & the Thread</a>
      {SPOTIFY_PLAYLIST_URL && <a className="rv-spotify-button" href={SPOTIFY_PLAYLIST_URL} target="_blank" rel="noopener noreferrer">Listen on Spotify ↗</a>}
      {failed ? <p role="alert">We couldn’t load the playlist page. <button className="rv-link" onClick={() => setAttempt(a => a + 1)}>Try again</button></p> : !event ? <p role="status">Loading the playlist…</p> : <Playlist slug={slug} token={token} going={mine?.status === 'going'} event={event} onRsvp={() => window.location.assign('/karaoke')} />}
    </main>
  </div>;
}
