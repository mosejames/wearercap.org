import { ArrowUpRight } from 'lucide-react';

export default function HomeCollective() {
  return <article className="home-collective">
    <div className="home-collective-copy">
      <p className="section-label">The RCAP Collective</p>
      <h3>Have you heard about the RCAP Collective?</h3>
      <p>There’s so much talent right here in our RCA family. The Collective brings our parents’ businesses, services, and creative work together in one place, so we can discover the resources we already have in-house.</p>
      <a className="button primary" href="/directory/">Check out the Collective <ArrowUpRight size={18} aria-hidden="true" /></a>
    </div>
    <div className="home-collective-invite">
      <p className="section-label">You’re part of it, too</p>
      <h4>Haven’t added your business yet?</h4>
      <p>This is your invitation. Share what you do and help our community get to know the resources right here among us.</p>
      <a className="home-collective-join" href="/directory/?view=new">Add your business <ArrowUpRight size={18} aria-hidden="true" /></a>
    </div>
  </article>;
}
