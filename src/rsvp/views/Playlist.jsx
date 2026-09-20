import { useEffect, useState } from 'react';
import { Music2 } from 'lucide-react';
import * as api from '../api.js';

const ARTISTS = ['Destiny’s Child', 'Keith Sweat', 'Brian McKnight', 'Jay-Z', 'LL COOL J'];
const ERRORS = {
  duplicate_song: 'You already added this favorite. Try another!',
  slow_down: 'Give it a few seconds before adding another song.',
  rsvp_required: 'Open your private RSVP link from your confirmation email to add a song.',
  event_closed: 'Song submissions are closed for this event.',
  invalid_song: 'Add a song title and artist, up to 120 characters each.',
  song_limit: 'You have added 30 favorites. Thanks for helping set the vibe!',
};

export default function Playlist({ slug, token, going, event, onRsvp }) {
  const [songs, setSongs] = useState(null);
  const [loadError, setLoadError] = useState(false);
  const [title, setTitle] = useState('');
  const [artist, setArtist] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);
  useEffect(() => {
    let active = true;
    const refresh = async () => {
      try {
        const rows = await api.loadSongs(slug);
        if (active) { setSongs(rows); setLoadError(false); }
      } catch { if (active) setLoadError(true); }
    };
    refresh();
    const onVisible = () => { if (document.visibilityState === 'visible') refresh(); };
    const timer = setInterval(onVisible, 30000);
    document.addEventListener('visibilitychange', onVisible);
    return () => { active = false; clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [slug]);

  async function submit(e) {
    e.preventDefault();
    if (busy) return;
    if (!going) { onRsvp(); return; }
    if (event?.status !== 'open') return;
    setError(''); setMessage('');
    if (!title.trim() || !artist.trim()) { setError(ERRORS.invalid_song); return; }
    setBusy(true);
    try {
      await api.submitSong(slug, token, title.trim(), artist.trim());
      setTitle(''); setArtist('');
      setMessage('Your song is in the mix. Thanks for adding to the vibe!');
      try { setSongs(await api.loadSongs(slug)); setLoadError(false); }
      catch { setLoadError(true); }
    } catch (e) { setError(ERRORS[e.message] || 'Your song could not be saved. Please try again.'); }
    finally { setBusy(false); }
  }
  const shown = songs ? (expanded ? songs : songs.slice(0, 8)) : [];
  return (
    <section className="rv-section rv-playlist" id="parent-playlist" aria-labelledby="playlist-title">
      <div className="rv-playlist-intro">
        <p className="rv-eyebrow"><Music2 size={17} aria-hidden="true" /> THE PARENT PLAYLIST</p>
        <h2 id="playlist-title">The Parent Playlist<br />Is Taking Shape</h2>
        <p>Built by RCA parents. The R&B favorites setting the vibe before karaoke night.</p>
        <a className="rv-ghost on-dark" href="#add-to-vibe">Add your favorite</a>
      </div>
      <div className="rv-playlist-body">
        <div className="rv-playlist-label"><h3>In the mix</h3>{songs && <span>{songs.length} parent pick{songs.length === 1 ? '' : 's'}</span>}</div>
        {loadError && <p role="status">The latest picks could not load. We’ll try again shortly.</p>}
        {!songs && !loadError && <p role="status">Loading the parent picks…</p>}
        {songs && !songs.length && <p>Add the first favorite and set the vibe.</p>}
        <ol className="rv-songs">
          {shown.map((song, index) => <li key={song.id}>
            <span className="rv-track-number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div><b>{song.title}</b><span>{song.artist}</span><small>{song.from_thread ? 'From the Thread' : 'Added'} · {song.wall_name}{song.house && <span className={`rv-song-house house-${song.house}`}>{song.house}</span>}</small></div>
          </li>)}
        </ol>
        {songs && songs.length > 8 && <button className="rv-link" onClick={() => setExpanded(!expanded)}>{expanded ? 'Show fewer picks' : `See all ${songs.length} picks`}</button>}
        <aside className="rv-artist-mentions"><b>Also getting love in the Thread</b><p>{ARTISTS.join(' · ')}</p><small>Artist shout-outs from parents. Add a favorite track below.</small></aside>
        <form id="add-to-vibe" className="rv-song-form" onSubmit={submit}>
          <h3>Add to the Vibe</h3>
          <p>Just sharing a favorite. No mic commitment required.</p>
          {event?.status !== 'open' ? <p>Song submissions are closed.</p> : <>
            <div className="rv-song-fields">
              <label htmlFor="song-title">Song title<input id="song-title" name="song-title" maxLength={120} required value={title} onChange={e => setTitle(e.target.value)} placeholder="Your R&B favorite" /></label>
              <label htmlFor="song-artist">Artist<input id="song-artist" name="song-artist" maxLength={120} required value={artist} onChange={e => setArtist(e.target.value)} placeholder="Who sings it?" /></label>
            </div>
            {going ? <><p className="rv-song-privacy">Your pick appears here with your RSVP name and house.</p><button className="rv-cta" disabled={busy} type="submit">{busy ? 'Adding…' : 'Add to the Vibe'}</button></> : <>
              <button type="button" className="rv-cta" onClick={onRsvp}>RSVP to add your song</button>
              <p className="rv-song-privacy">Already RSVP’d? Open your private link from your confirmation email to add your favorites.</p>
            </>}
          </>}
          {error && <p className="rv-song-error" role="alert">{error}</p>}
          {message && <p className="rv-song-success" role="status">{message}</p>}
        </form>
      </div>
    </section>
  );
}
