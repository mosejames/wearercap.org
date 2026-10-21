import { ImageResponse } from '@vercel/og';
import { createElement as h } from 'react';
import { raffleTimeLeft } from '../src/events/raffleCountdown.js';
const box = (style, ...children) => h('div', { style: { display: 'flex', ...style } }, ...children);
export function raffleCountdownImage(fonts, now = Date.now()) {
  const left = raffleTimeLeft(now);
  const updated = new Intl.DateTimeFormat('en-US', { timeZone: 'America/New_York', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' }).format(now);
  const tree = box({ width: '100%', height: '100%', flexDirection: 'column', padding: '20px 24px', background: '#1a2a56', color: '#faf4ea', fontFamily: 'Figtree' },
    box({ color: '#f7a81c', fontSize: 13, fontWeight: 900, letterSpacing: 2 }, left.closed ? 'FIRST-DRAWING ENTRIES CLOSED' : 'TIME LEFT TO ENTER SUNDAY’S FIRST DRAWING'),
    left.closed
      ? box({ fontSize: 25, marginTop: 20, marginBottom: 20, fontWeight: 900 }, 'See the raffle page for upcoming drawings.')
      : box({ gap: 28, justifyContent: 'space-between', marginTop: 10, marginBottom: 10 }, ...['days', 'hours', 'minutes'].map((unit) => box({ flexDirection: 'column', alignItems: 'center', width: 110 },
        box({ fontSize: 46, fontWeight: 900 }, String(left[unit]).padStart(2, '0')),
        box({ fontSize: 11, letterSpacing: 2, textTransform: 'uppercase' }, unit)))),
    box({ fontSize: 12, marginTop: 'auto' }, 'Entry deadline: Saturday, October 24 · 11:59 p.m. Eastern'),
    box({ fontSize: 10, color: '#d3dae8', marginTop: 5 }, `As of ${updated} Eastern`));
  return new ImageResponse(tree, { width: 588, height: 184, fonts });
}
