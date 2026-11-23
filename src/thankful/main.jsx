import React, { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { createClient } from '@supabase/supabase-js';
import { ArrowLeft, Camera, Image, ImagePlus, Upload, Video } from 'lucide-react';
import CardDeck from './CardDeck.jsx';
import CameraRecorder from './CameraRecorder.jsx';
import { MessageComposer, MessageGallery } from './MessageGallery.jsx';
import VideoEditor from './VideoEditor.jsx';
import './style.css';

const Moderation = lazy(() => import('./Moderation.jsx'));

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

function SharePrompt({ card, onSelect }) {
  const swipe = useRef(null);
  const [direction, setDirection] = useState(0);
  const index = cards.indexOf(card);
  function neighbor(direction) {
    return cards[(index + direction + cards.length) % cards.length];
  }

  function changePrompt(direction) {
    setDirection(direction);
    onSelect(neighbor(direction));
  }

  return <div className="share-prompt-deck">
    {[-1, 1].map(direction => <button key={direction} type="button"
      className={`share-prompt-peek ${direction < 0 ? 'previous' : 'next'}`}
      aria-label={`${direction < 0 ? 'Previous' : 'Next'} prompt: ${neighbor(direction)[0]}`}
      onClick={() => changePrompt(direction)}>
      <span aria-hidden="true">{direction < 0 ? '‹' : '›'}</span>
    </button>)}
    <div key={card[0]} className="capture-prompt" aria-live="polite"
      data-slide={direction || undefined} onPointerDown={event => {
      if (!event.isPrimary || event.button !== 0) return;
      swipe.current = { id: event.pointerId, x: event.clientX, y: event.clientY };
      event.currentTarget.setPointerCapture(event.pointerId);
    }} onPointerUp={event => {
      const down = swipe.current;
      swipe.current = null;
      if (!down || down.id !== event.pointerId) return;
      const x = event.clientX - down.x;
      const y = event.clientY - down.y;
      if (Math.abs(x) >= 40 && Math.abs(x) > Math.abs(y)) changePrompt(x < 0 ? 1 : -1);
    }} onLostPointerCapture={() => { swipe.current = null; }}>
      <span className="small">Thankful at RCA</span>
      <h2>{card[0]}</h2>
      <p>{card[1]}</p>
    </div>
  </div>;
}

function App() {
  const [card, setCard] = useState(null);
  const [file, setFile] = useState(null);
  const heading = useRef(null);
  const [step, setStep] = useState('deck');
  const screen = file ? 'finish' : step;
  const previousScreen = useRef(screen);
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
    if (previousScreen.current === screen) return;
    previousScreen.current = screen;
    window.scrollTo({ top: 0, behavior: 'instant' });
    heading.current?.focus({ preventScroll: true });
  }, [screen]);

  function startOver() {
    setFile(null);
    setError('');
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
      <a href="/" className="mark"><img src="/images/we-are-rcap-logo.png" alt="We Are RCAP" width="46" height="41"/></a>
      <span className="occasion">Thanksgiving 2026</span>
    </header>
    {screen === 'finish' && <main className="finishing">
      <h1 ref={heading} tabIndex={-1}>Finish your video</h1>
      <VideoEditor file={file} card={card} storage={supabase?.storage} onBusy={setBusy}/>
      <button className="start-over" type="button" onClick={startOver} disabled={busy}>Start over</button>
    </main>}
    <main hidden={screen !== 'deck'}>
      <section className="hero">
        <div className="intro">
          <div className="eyebrow"><span>✦</span> The Ron Clark Academy</div>
          <h1 ref={screen === 'deck' ? heading : null} tabIndex={-1}>Thankful <em>at RCA.</em></h1>
          <p>Shuffle the cards to reveal a prompt. Then share what you’re thankful for with a photo and a message or a short video.</p>
        </div>
        <CardDeck cards={cards} card={card} onDraw={setCard} disabled={busy} onCreate={() => setStep('create')}/>
      </section>
    </main>
    {screen === 'create' && <main className="finishing capture-choice share-screen">
      <button className="text-link" type="button" onClick={() => { setError(''); setStep('deck'); }}>
        <ArrowLeft size={16}/> Back to cards
      </button>
      <h1 ref={heading} tabIndex={-1}>Share your gratitude</h1>
      <SharePrompt card={card} onSelect={setCard}/>
      <section className="share-option" aria-labelledby="share-photo-title">
        <div className="share-option-heading">
          <span className="share-option-icon"><Image size={19} aria-hidden="true"/></span>
          <div><h2 id="share-photo-title">Share a photo + message</h2><p>Pick a photo you already have and add a sentence about what you’re thankful for.</p></div>
        </div>
        <button type="button" className="button" onClick={() => { setError(''); setStep('message'); }}>
          <ImagePlus size={18}/> Add a photo
        </button>
      </section>
      <div className="share-option-divider">or</div>
      <section className="share-option" aria-labelledby="share-video-title">
        <div className="share-option-heading">
          <span className="share-option-icon"><Video size={19} aria-hidden="true"/></span>
          <div><h2 id="share-video-title">Share a video</h2><p>Record a short clip, up to 30 seconds, or upload one from your phone.</p></div>
        </div>
        <button type="button" className="button upload-choice" onClick={() => setCameraOpen(true)}><Camera size={18}/> Record live</button>
        <label className="button upload-choice"><Upload size={18}/> Upload a video
          <input aria-describedby="upload-formats" type="file"
            accept="video/mp4,video/quicktime,video/webm,.mov,.mp4,.webm" onChange={chooseFile}/>
        </label>
        <p className="hint" id="upload-formats">MP4, MOV or WebM · Up to 150 MB</p>
        {error && <p className="error" role="alert">{error}</p>}
      </section>
    </main>}
    {screen === 'message' && <main className="finishing capture-choice message-choice">
      <button className="text-link" type="button" disabled={busy} onClick={() => setStep('create')}><ArrowLeft size={16}/> Back</button>
      <h1 ref={heading} tabIndex={-1}>Write a gratitude card</h1>
      <MessageComposer card={card} client={supabase} onBusy={setBusy} onGallery={() => setStep('gallery')}/>
    </main>}
    {screen === 'gallery' && <main className="finishing gallery-page">
      <button className="text-link" type="button" onClick={() => setStep('deck')}><ArrowLeft size={16}/> Back to cards</button>
      <h1 ref={heading} tabIndex={-1}>Gratitude gallery</h1>
      <MessageGallery client={supabase}/>
    </main>}
    {cameraOpen && <CameraRecorder card={card} onClose={() => setCameraOpen(false)} onRecorded={recordingReady}/>}
    <footer><a href="/">We Are RCAP</a>
      {screen === 'deck' && <button className="text-link" type="button" onClick={() => setStep('gallery')}>View gallery</button>}
    </footer>
  </>;
}
const admin = new URLSearchParams(location.search).has('moderate');
createRoot(document.getElementById('root')).render(admin
  ? <Suspense fallback={<p role="status">Loading moderation…</p>}><Moderation/></Suspense>
  : <App/>);
