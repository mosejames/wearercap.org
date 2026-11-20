import React, { useEffect, useRef, useState } from 'react';

const suits = ['♠', '♥', '♣', '♦', '♠', '♥'];

function CardBack() {
  return <div className="playing-back" aria-hidden="true">
    <span className="back-medallion"><img src="/images/we-are-rcap-logo.png" alt="" draggable={false}/></span>
  </div>;
}

export default function CardDeck({ cards, card, onDraw, disabled, onCreate }) {
  const suit = suits[cards.indexOf(card)];
  const [remaining, setRemaining] = useState(cards);
  const [shuffling, setShuffling] = useState(false);
  const [drag, setDrag] = useState(0);
  const [sweep, setSweep] = useState(1);
  const gesture = useRef(null);
  const timer = useRef(null);
  useEffect(() => () => clearTimeout(timer.current), []);

  function draw(direction = 1) {
    if (disabled || timer.current) return;
    const available = remaining.length ? remaining : cards.filter((item) => item !== card);
    const next = available[Math.floor(Math.random() * available.length)];
    setDrag(0);
    setSweep(direction);
    setShuffling(true);
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    timer.current = setTimeout(() => {
      timer.current = null;
      setRemaining(available.filter((item) => item !== next));
      setDrag(0);
      setShuffling(false);
      onDraw(next);
    }, reducedMotion ? 15 : 1120);
  }

  function startSwipe(event) {
    if (disabled || shuffling || !event.isPrimary || event.button !== 0) return;
    gesture.current = { id: event.pointerId, start: event.clientX };
  }

  function moveSwipe(event) {
    if (gesture.current?.id !== event.pointerId) return;
    const travel = event.currentTarget.clientWidth * .19;
    setDrag(Math.max(-travel, Math.min(travel, event.clientX - gesture.current.start)));
  }

  function endSwipe(event) {
    if (gesture.current?.id !== event.pointerId) return;
    const distance = event.clientX - gesture.current.start;
    gesture.current = null;
    setDrag(0);
    if (Math.abs(distance) >= 42) draw(Math.sign(distance));
  }

  return <div className="deck-area">
    <button type="button" className="shuffle-hint" id="shuffle-hint" onClick={() => draw()}
      disabled={disabled || shuffling} aria-label="Shuffle cards, or swipe left or right on the deck">
      <svg viewBox="0 0 44 17" aria-hidden="true"><path d="M42 3Q20 2 4 13m2-7-2 7 8-1"/></svg>
      Shuffle
      <svg viewBox="0 0 44 17" aria-hidden="true"><path d="M42 3Q20 2 4 13m2-7-2 7 8-1"/></svg>
    </button>
    <div className={`deck ${shuffling ? 'is-shuffling' : ''}`}
      style={{ '--drag': `${drag}px`, '--tilt': `${drag / 8}deg`, '--sweep': sweep }}
      onPointerDown={startSwipe} onPointerMove={moveSwipe} onPointerUp={endSwipe}
      onPointerLeave={() => { gesture.current = null; if (!shuffling) setDrag(0); }}
      onPointerCancel={() => { gesture.current = null; setDrag(0); }}>
      <div className="stack one"/><div className="stack two"/><div className="stack three"/>
      {shuffling && <div className="shuffle-deck" aria-hidden="true">
        {cards.map(([name], index) => <div className="shuffle-card" key={name}
          style={{ '--spread': index - 2.5, '--order': index, '--packet': index < 3 ? -1 : 1 }}>
          <CardBack/>
        </div>)}
      </div>}
      <div className="deck-top" aria-live="polite" aria-busy={shuffling}>
        {card && !shuffling ? <div className="face prompt" key={card[0]}>
          <span className={`card-index ${suit === '♥' || suit === '♦' ? 'warm-suit' : ''}`} aria-hidden="true">{suit}</span>
          <span className={`card-index card-index-opposite ${suit === '♥' || suit === '♦' ? 'warm-suit' : ''}`} aria-hidden="true">{suit}</span>
          <span className="small">Thankful at RCA</span>
          <h2>{card[0]}</h2><p>{card[1]}</p><em>I’m thankful for…</em>
        </div> : shuffling ? <span className="shuffle-status" role="status">Shuffling cards</span> : <button className="face back" onClick={() => draw()} aria-label="Pull a card" aria-describedby="shuffle-hint" disabled={disabled || shuffling}>
          <CardBack/>
        </button>}
      </div>
    </div>
    <div className="deck-actions">
      {card && <button className="button" type="button" onClick={onCreate} disabled={disabled || shuffling}>Create video</button>}
    </div>
  </div>;
}
