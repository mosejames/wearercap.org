import { ArrowUpRight } from 'lucide-react';

export const RAFFLE_URL = 'https://www.zeffy.com/en-US/ticketing/ron-clark-academy-parents-fall-fundraiser--2026';

export default function HomeRaffle() {
  return <article className="home-collective home-raffle">
    <div className="home-collective-copy">
      <p className="section-label">First drawing: Sunday, October 25</p>
      <h3>Every ticket says thank you.</h3>
      <p>Every $1 ticket supports Teacher Appreciation Week and the faculty and staff who pour into our scholars all year.</p>
      <p><strong>Enter by Saturday, October 24 at 11:59 p.m.</strong> for the first drawing. We invite every family to sell at least $100. Share the link with family and friends, and ask them to include your child's name, class and house so your student gets credit.</p>
      <p>Weekly drawings are October 25, November 1 and November 8. A weekly win keeps you eligible for future drawings, including the grand prize. Watch RCAP's Instagram for the winner announcement; winners also receive an email.</p>
      <a className="button primary" href={RAFFLE_URL}>Buy raffle tickets <ArrowUpRight size={18} aria-hidden="true" /></a>
      <p className="home-raffle-note">Ticket sales end November 16. The grand-prize drawing date will be announced separately.</p>
    </div>
    <a className="home-collective-visual" href={RAFFLE_URL} aria-label="Buy RCAP Fall Raffle tickets, $1 each">
      <img src="/images/rcap-raffle-first-drawing.png" alt="RCAP Fall Raffle. First drawing this Sunday, October 25. Tickets $1. Enter by Saturday, October 24 at 11:59 p.m. Supporting Teacher Appreciation Week." width="1200" height="630" loading="lazy" />
      <span>Get ready for Sunday's drawing <ArrowUpRight size={18} aria-hidden="true" /></span>
    </a>
  </article>;
}
