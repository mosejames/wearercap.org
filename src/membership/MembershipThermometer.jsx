import React, { useEffect, useRef, useState } from 'react';
import './membership.css';

// Update the confirmed family count here. The goal controls the visual only.
export const MEMBERSHIP = { families: 75, goal: 160, paymentUrl: 'https://www.paypal.com/ncp/payment/EWP8R298MW83A' };

function Thermometer({ progress, burst = false }) {
  return (
    <div className={`membership-meter${burst ? ' is-full' : ''}`} aria-hidden="true" style={{
      '--fill': `${progress * 100}%`, '--shake': `${progress * progress * 3}deg`,
      '--pace': `${2.4 - progress * 1.9}s`,
    }}>
      <div className="membership-glass">
        <div className="membership-liquid">
          {Array.from({ length: 7 }, (_, i) => <i key={i} style={{ '--i': i }} />)}
        </div>
        <div className="membership-ticks" />
      </div>
      <div className="membership-bulb"><span /></div>
      {burst && <div className="membership-burst">{Array.from({ length: 12 }, (_, i) => <i key={i} style={{ '--i': i }} />)}</div>}
    </div>
  );
}

export default function MembershipThermometer({ families = MEMBERSHIP.families, goal = MEMBERSHIP.goal, paymentUrl = MEMBERSHIP.paymentUrl }) {
  const count = Math.max(0, Math.floor(families));
  const ratio = Math.min(1, count / Math.max(1, goal));
  const trigger = useRef(null);
  const dialog = useRef(null);
  const frame = useRef(null);
  const closing = useRef(false);
  const [shown, setShown] = useState(count);
  const [open, setOpen] = useState(false);
  const [tucked, setTucked] = useState(false);
  const tuckButton = useRef(null);
  const reopenButton = useRef(null);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let id;
    const start = performance.now();
    const tick = (now) => {
      const elapsed = Math.min(1, (now - start) / 1800);
      setShown(Math.round(count * (1 - (1 - elapsed) ** 3)));
      if (elapsed < 1) id = requestAnimationFrame(tick);
    };
    if (reduced) setShown(count);
    else id = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(id); document.body.style.overflow = previousOverflow; };
  }, [open, count]);

  function motion(reverse = false) {
    const from = trigger.current.getBoundingClientRect();
    const to = frame.current.getBoundingClientRect();
    const small = `translate(${from.x + from.width / 2 - to.x - to.width / 2}px, ${from.y + from.height / 2 - to.y - to.height / 2}px) scale(${from.width / to.width}, ${from.height / to.height})`;
    return frame.current.animate(
      reverse ? [{ transform: 'none', opacity: 1 }, { transform: small, opacity: 0 }] : [{ transform: small, opacity: 0 }, { transform: 'none', opacity: 1 }],
      { duration: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 0 : 380, easing: 'cubic-bezier(.22,1,.36,1)', fill: 'forwards' },
    );
  }

  function expand() {
    if (dialog.current.open) return;
    setShown(0);
    dialog.current.showModal();
    setOpen(true);
    motion();
  }

  async function collapse() {
    if (closing.current) return;
    closing.current = true;
    await motion(true).finished;
    dialog.current.close();
    setOpen(false);
    closing.current = false;
    trigger.current.focus();
  }

  return <>
    <button ref={reopenButton} type="button" className="membership-reopen" hidden={!tucked} onClick={() => {
      setTucked(false);
      requestAnimationFrame(() => tuckButton.current?.focus());
    }} aria-label="Show membership donations"><span aria-hidden="true">‹</span></button>
    <aside className={`membership-dock${tucked ? ' is-tucked' : ''}`} aria-label="Membership donations" inert={tucked}>
    <button ref={tuckButton} type="button" className="membership-tuck" onClick={() => {
      setTucked(true);
      requestAnimationFrame(() => reopenButton.current?.focus());
    }} aria-label="Hide membership donations"><span aria-hidden="true">›</span></button>
    <button ref={trigger} className="membership-launcher" onClick={expand} aria-label={`${count} families have made their membership donation. View progress and donate.`} aria-haspopup="dialog">
      <Thermometer progress={ratio} />
      <span className="membership-launcher-copy"><strong>{count}</strong><small>families</small><span>toward our goal</span></span>
    </button>
    {paymentUrl && <button type="button" className="membership-dock-donate" onClick={expand} aria-haspopup="dialog">Make Your Membership Donation <span aria-hidden="true">↗</span></button>}
    </aside>
    <dialog className="membership-dialog" ref={dialog} aria-labelledby="membership-title" onCancel={(event) => { event.preventDefault(); collapse(); }} onClick={(event) => { if (event.target === dialog.current) collapse(); }}>
      <div ref={frame} className="membership-card">
        <button className="membership-close" onClick={collapse} aria-label="Close membership progress" autoFocus>×</button>
        <p className="membership-eyebrow">A little from each. A lot for all.</p>
        <h2 id="membership-title">Look what we're<br />building together.</h2>
        <div className="membership-display">
          <Thermometer progress={Math.min(1, shown / Math.max(1, goal))} burst={open && ratio === 1 && shown === count} />
          <div className="membership-total"><strong aria-hidden="true">{shown}</strong><span>family memberships</span><span className="membership-goal-label">toward our goal</span><span className="membership-sr">{count} families have made their membership donation.</span></div>
        </div>
        <p className="membership-copy">{ratio === 1 ? 'We did it! Thank you for showing up for our RCA community.' : 'Every membership donation helps our parent community do more. Add your family to the love.'}</p>
        {paymentUrl ? <a className="membership-donate" href={paymentUrl} target="_blank" rel="noopener noreferrer">Make your membership donation <span aria-hidden="true">↗</span></a> : <p className="membership-link-pending">Donation link coming soon.</p>}
        <button className="membership-later" onClick={collapse}>Back to the village</button>
      </div>
    </dialog>
  </>;
}
