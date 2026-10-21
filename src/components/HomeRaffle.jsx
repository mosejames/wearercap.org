import { ArrowUpRight } from 'lucide-react';

export const RAFFLE_URL = 'https://www.zeffy.com/en-US/ticketing/ron-clark-academy-parents-fall-fundraiser--2026';

export default function HomeRaffle() {
  return <article className="home-collective home-raffle">
    <div className="home-collective-copy">
      <p className="section-label">First drawing: Sunday, October 25</p>
      <h3>Every ticket says thank you.</h3>
      <p>Your $1 ticket helps celebrate the teachers and staff who give our scholars so much.</p>
      <p><strong>Enter by Saturday, October 24 at 11:59 p.m.</strong></p>
      <a className="button primary" href={RAFFLE_URL}>Buy tickets <ArrowUpRight size={18} aria-hidden="true" /></a>
    <p><a href="/events/2026/fall-raffle/">Raffle details and drawing dates ↗</a></p>
    </div>
    <a className="home-collective-visual" href={RAFFLE_URL} aria-label="Buy RCAP Fall Raffle tickets, $1 each">
      <img src="/images/rcap-raffle-first-drawing.png" alt="RCAP Fall Raffle. First drawing this Sunday, October 25. Tickets $1. Enter by Saturday, October 24 at 11:59 p.m. Supporting Teacher Appreciation Week." width="1200" height="630" loading="lazy" />
    </a>
  </article>;
}
