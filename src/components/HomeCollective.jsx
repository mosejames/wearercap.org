import { ArrowUpRight } from 'lucide-react';

export default function HomeCollective() {
  return <article className="home-collective">
    <div className="home-collective-copy">
      <p className="section-label">The RCAP Collective</p>
      <h3>Have you heard about the RCAP Collective?</h3>
      <p>There’s so much talent right here in our RCA family. The Collective brings our parents’ businesses, services, and creative work together in one place, so we can discover the resources we already have in-house.</p>
      <a className="button primary" href="/directory/">Check out the Collective <ArrowUpRight size={18} aria-hidden="true" /></a>
    </div>
    <a className="home-collective-visual" href="/directory/" aria-label="Explore the RCAP Collective business directory">
      <img src="/images/collective-community.webp" alt="A computer-screen collage of the RCAP Collective featuring Donna Jenkins Realty, Max Rentals, OMG Booth, The LinkedIn Pros, and Walker Law LLC" width="1600" height="1200" loading="lazy" />
      <span>Take a look inside <ArrowUpRight size={18} aria-hidden="true" /></span>
    </a>
  </article>;
}
