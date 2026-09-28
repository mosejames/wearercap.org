import { useEffect, useState } from 'react';
import { ArrowUpRight, Plus } from 'lucide-react';
import { supabase } from '../carpool/supabaseClient.js';

export default function HomeCollective() {
  const [listings, setListings] = useState([]);
  useEffect(() => {
    let active = true;
    supabase.from('directory_listings').select('id,name,category,photos')
      .eq('published', true).order('name').limit(6)
      .then(({ data, error }) => { if (active && !error) setListings(data || []); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return <article className="home-collective">
    <div className="home-collective-copy">
      <p className="section-label">The RCAP Collective</p>
      <h3>Your next connection<br />is already in the family.</h3>
      <p>Discover the businesses, talents, and ideas growing right here in our RCA community. Find someone to hire, a service you need, or a parent to build with.</p>
      <a className="button primary" href="/directory/">Explore the Collective <ArrowUpRight size={18} aria-hidden="true" /></a>
      <a className="home-collective-join" href="/directory/?view=new">Have a business or a creative venture? Join the Collective <ArrowUpRight size={16} aria-hidden="true" /></a>
    </div>
    <div className="home-collective-list" aria-label="Meet businesses in the Collective">
      {listings.map(item => <a key={item.id} className="home-business" href={`/directory/?view=listing&id=${encodeURIComponent(item.id)}`}>
        {item.photos?.[0] ? <img src={supabase.storage.from('directory-photos').getPublicUrl(item.photos[0]).data.publicUrl} alt="" loading="lazy" onError={e => {e.currentTarget.style.display='none';}} /> : null}
        <span><small>{item.category}</small><strong>{item.name}</strong><em>Meet the business ↗</em></span>
      </a>)}
      <a className="home-business home-business-add" href="/directory/?view=new"><Plus size={30} aria-hidden="true" /><span><small>Make your next connection</small><strong>Your business belongs here.</strong><em>Join the Collective ↗</em></span></a>
    </div>
  </article>;
}
