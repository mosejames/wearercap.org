import React, { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { Camera } from 'lucide-react';
import CardDeck from './CardDeck.jsx';
import CameraRecorder from './CameraRecorder.jsx';
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
  const [card, setCard] = useState(null);
  const [file, setFile] = useState(null);
  const finishHeading = useRef(null);
  const [busy, setBusy] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [error, setError] = useState('');

  function useFile(selected) {
    setError('');
    setFile(selected);

  }

  function recordingReady(selected) {
    setCameraOpen(false);
    useFile(selected);

  }

  useEffect(() => {
    if (!file) return;
    window.scrollTo({ top: 0, behavior: 'instant' });
    finishHeading.current?.focus({ preventScroll: true });
  }, [file]);

  function startOver() {
    setFile(null);
    setError('');
    requestAnimationFrame(() => document.getElementById('record')?.scrollIntoView({ behavior: 'instant' }));
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
    useFile(selected);
  }

  return <>
    <header className="site-header">
      <a href="/" className="mark"><span>WE ARE</span><strong>RCAP<span>.</span></strong></a>
      <span className="occasion">Thanksgiving 2026</span>
    </header>
    {file ? <main className="finishing">
      <h1 ref={finishHeading} tabIndex={-1}>Finish your video</h1>
      <VideoEditor file={file} card={card} storage={supabase?.storage} onBusy={setBusy}/>
      <button className="start-over" type="button" onClick={startOver} disabled={busy}>Start over</button>
    </main> : <main>
      <section className="hero">
        <div className="intro">
          <div className="eyebrow"><span>✦</span> The Ron Clark Academy</div>
          <h1>Thankful <em>at RCA.</em></h1>
          <p>A moment. A lesson. A little growth you almost missed. Pull a card and share one thing you’re thankful for.</p>
        </div>
        <CardDeck cards={cards} card={card} onDraw={setCard} disabled={busy} onRecord={() => setCameraOpen(true)}/>
      </section>
      <section className="record" id="record">
        <div className="submission">
          <Camera size={25}/><h2>Make your video</h2>
          <p>{card ? <>Your prompt is <strong>{card[0]}</strong>. Record here or upload a clip, then preview, trim and send.</> :
            'Pull a card above to get started.'}</p>
          {card &&
            <>
              <button type="button" className="button camera-launch" disabled={busy} onClick={() => setCameraOpen(true)}>
                <Camera size={18}/> Open camera
              </button>
              <label htmlFor="video">Choose a video <span className="hint">MP4, MOV or WebM · Up to 150 MB</span></label>
              <input id="video" type="file" accept="video/mp4,video/quicktime,video/webm,.mov,.mp4,.webm" disabled={busy} onChange={chooseFile}/>
              {error && <p className="error" role="alert">{error}</p>}
            </>}
        </div>
      </section>
    </main>}
    {cameraOpen && <CameraRecorder card={card} onClose={() => setCameraOpen(false)} onRecorded={recordingReady}/>}
    <footer><a href="/">We Are RCAP</a><span>Ron Clark Academy Parents</span></footer>
  </>;
}
createRoot(document.getElementById('root')).render(<App />);
