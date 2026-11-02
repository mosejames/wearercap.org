import {ChevronDown} from 'lucide-react';
import {tripGuide} from './trip-guides.js';
export default function TripGuide({trip}) {
  const guide = tripGuide(trip);
  if (!guide) return null;
  return <details className="engine-trip-guide"><summary><span><small>THE ADVENTURE AHEAD</small><b>Explore the trip</b></span><span className="engine-guide-count">{guide.stops.length} planned stops</span><span className="engine-guide-chevron" aria-hidden="true"><ChevronDown size={20}/></span></summary><div className="engine-guide-body"><h2>{guide.title}</h2><p>From museums to memorials, a new story around every corner.</p><ul>{guide.stops.map(stop=><li key={stop}>{stop}</li>)}</ul><small>Planned stops from the family trip guide. Order may change.</small></div></details>;
}
