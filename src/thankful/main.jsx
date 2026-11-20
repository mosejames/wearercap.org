import React, { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { ArrowDown, Camera, Mic, Smartphone, Sun, Shuffle } from 'lucide-react';
import VideoEditor from './VideoEditor.jsx';
import './style.css';

const cards = [
  ['Growth', 'What growth have you seen in your child at RCA that you’re thankful for?'],
  ['Moment', 'What’s one RCA memory you’re glad your family got to experience?'],
  ['Surprise', 'What did RCA bring into your family’s life that you didn’t see coming?'],
  ['People', 'Who at RCA made a difference for your family, and what did they do?'],
  ['Belonging', 'When did you first feel like your family was part of the RCA community?'],
  ['Lesson', 'What’s one lesson your child learned at RCA that you’re grateful they’ll carry with them?'],
];
const MAX_SOURCE_SIZE = 150 * 1024 * 1024;
const types = { mp4: 'video/mp4', mov: 'video/quicktime', webm: 'video/webm' };
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = supabaseUrl && supabaseKey ? createClient(supabaseUrl, supabaseKey, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
}) : null;

function App() {
  const [deck, setDeck] = useState(cards);
  const [card, setCard] = useState(null);
  const [file, setFile] = useState(null);
  const [fileRevision, setFileRevision] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  function draw() {
    const available = deck.length ? deck : cards.filter((item) => item !== card);
    const next = available[Math.floor(Math.random() * available.length)];
    setCard(next);
    setDeck(available.filter((item) => item !== next));
  }

  function chooseFile(event) {
    const selected = event.target.files[0];
    if (!selected) return;
    const extension = selected.name.split('.').pop().toLowerCase();
    if (!Object.hasOwn(types, extension) || selected.size === 0 || selected.size > MAX_SOURCE_SIZE) {
      event.target.value = '';
      setError('Choose an MP4, MOV or WebM video up to 150 MB.');
      return;
    }
    setError('');
    setFile(selected);
    setFileRevision((version) => version + 1);
  }

  return <>
    <header className="site-header">
      <a href="/" className="mark"><span>WE ARE</span><strong>RCAP<span>.</span></strong></a>
      <span className="occasion">Thanksgiving 2026</span>
    </header>
    <main>
      <section className="hero">
        <div className="intro">
          <div className="eyebrow"><span>✦</span> The Ron Clark Academy</div>
          <h1>Thankful <em>at RCA.</em></h1>
          <p>A moment. A lesson. A little growth you almost missed. Pull a card and share one thing you’re thankful for.</p>
          <a className="text-link" href="#record">How to record <ArrowDown size={16}/></a>
        </div>
        <div className="deck-area">
          <div className="deck" aria-live="polite">
            <div className="stack one"></div><div className="stack two"></div>
            {card ? <div className="face prompt" key={card[0]}>
              <span className="small">✦ &nbsp; Thankful at RCA</span>
              <h2>{card[0]}</h2><p>{card[1]}</p><em>I’m thankful for…</em>
            </div> : <button className="face back" onClick={draw} aria-label="Pull a card">
              <span className="small">The gratitude deck</span>
              <span className="orbit" aria-hidden="true"><span>✦</span></span>
              <strong>Pick a card</strong><span className="tap">Tap to reveal your prompt</span>
            </button>}
          </div>
          {card ? <div className="deck-actions">
            <button className="text-link" onClick={draw} disabled={busy}><Shuffle size={16}/> Pull another</button>
            <a className="button" href="#record">Use this prompt <ArrowDown size={16}/></a>
          </div> : <div className="deck-caption">✧ &nbsp; Every card starts a different story &nbsp; ✧</div>}
        </div>
      </section>
      <section className="record" id="record">
        <div className="guide">
          <div className="eyebrow"><span>✦</span> Your turn</div>
          <h2>Make it a moment.</h2>
          <p>Record a short video with your phone’s camera. Aim for about 30 seconds and answer in your own words.</p>
          <ul>
            <li><Sun/><div><strong>Find good light</strong><span>Face a window or a lamp so we can see you clearly.</span></div></li>
            <li><Mic/><div><strong>Find a quiet spot</strong><span>Turn off music and background noise so we can hear you.</span></div></li>
            <li><Smartphone/><div><strong>Hold your phone upright</strong><span>Record in portrait with the camera at eye level.</span></div></li>
          </ul>
        </div>
        <div className="submission">
          <Camera size={25}/><h2>Make your video</h2>
          <p>{card ? <>Your prompt is <strong>{card[0]}</strong>. Choose a clip to preview, trim and send.</> :
            'Pull a card to get your prompt, then come back here with your video.'}</p>
          {!card ? <button className="button" type="button" onClick={() => { draw(); document.querySelector('.hero').scrollIntoView(); }}>Pull a card</button> :
            <>
              <label htmlFor="video">Choose a video <span className="hint">MP4, MOV or WebM · Up to 150 MB</span></label>
              <input id="video" type="file" accept="video/mp4,video/quicktime,video/webm,.mov,.mp4,.webm" disabled={busy} onChange={chooseFile}/>
              {error && <p className="error" role="alert">{error}</p>}
              {file && <VideoEditor key={fileRevision} file={file} card={card} storage={supabase?.storage} onBusy={setBusy}/>}
            </>}
        </div>
      </section>
    </main>
    <footer><a href="/">We Are RCAP</a><span>Ron Clark Academy Parents</span></footer>
  </>;
}
createRoot(document.getElementById('root')).render(<App />);
