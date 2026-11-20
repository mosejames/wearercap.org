import React, { useEffect, useRef, useState } from 'react';
import { Shuffle } from 'lucide-react';

export default function CardDeck({ cards, card, onDraw, disabled, onRecord }) {
  const [remaining, setRemaining] = useState(cards);
  const [shuffling, setShuffling] = useState(false);
  const [drag, setDrag] = useState(0);
  const gesture = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  function draw(direction = 1) {
    if (disabled || timer.current) return;
    const available = remaining.length ? remaining : cards.filter((item) => item !== card);
    const next = available[Math.floor(Math.random() * available.length)];
    setDrag(direction * 32);
    setShuffling(true);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(() => {
      timer.current = null;
      setRemaining(available.filter((item) => item !== next));
      setDrag(0);
      setShuffling(false);
      onDraw(next);
    }, reducedMotion ? 15 : 760);
  }

  function startSwipe(event) {
    if (disabled || shuffling || !event.isPrimary || event.button !== 0) return;
    gesture.current = { id: event.pointerId, start: event.clientX };
  }

  function moveSwipe(event) {
    if (gesture.current?.id !== event.pointerId) return;
    setDrag(Math.max(-110, Math.min(110, event.clientX - gesture.current.start)));
  }

  function endSwipe(event) {
    if (gesture.current?.id !== event.pointerId) return;
    const distance = event.clientX - gesture.current.start;
    gesture.current = null;
    setDrag(0);
    if (Math.abs(distance) >= 42) draw(Math.sign(distance));
  }

  return <div className="deck-area">
    <div className={`deck ${shuffling ? 'is-shuffling' : ''}`}
      style={{ '--drag': `${drag}px`, '--tilt': `${drag / 8}deg`, '--sweep': drag < 0 ? '-1' : '1' }}
      onPointerDown={startSwipe} onPointerMove={moveSwipe} onPointerUp={endSwipe}
      onPointerLeave={() => { gesture.current = null; if (!shuffling) setDrag(0); }}
      onPointerCancel={() => { gesture.current = null; setDrag(0); }}>
      <div className="stack one"/><div className="stack two"/><div className="stack three"/>
      <div className="deck-top" aria-live="polite" aria-busy={shuffling}>
        {card && !shuffling ? <div className="face prompt" key={card[0]}>
          <span className="small">✦ &nbsp; Thankful at RCA</span>
          <h2>{card[0]}</h2><p>{card[1]}</p><em>I’m thankful for…</em>
        </div> : <button className="face back" onClick={() => draw()} aria-label="Pull a card" disabled={disabled || shuffling}>
          <span className="small">The gratitude deck</span>
          <span className="orbit" aria-hidden="true"><span>✦</span></span>
          <strong>{shuffling ? 'Shuffling…' : 'Pick a card'}</strong><span className="tap">Tap or swipe to draw</span>
        </button>}
      </div>
    </div>
    <div className="deck-actions">
      {card ? <>
        <button className="text-link" onClick={() => draw()} disabled={disabled || shuffling}><Shuffle size={16}/> Pull another</button>
        <button className="button" type="button" onClick={onRecord} disabled={disabled || shuffling}>Record this prompt</button>
      </> : <span className="deck-caption">Swipe left or right</span>}
    </div>
  </div>;
}
