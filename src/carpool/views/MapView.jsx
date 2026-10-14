import { useEffect, useRef, useState } from 'react';
import { loadMaps } from '../maps.js';
import { fetchNearby, fetchAreaCount } from '../directory.js';
import { scheduleOverlap } from '../compatibility.js';
import Collapsible from './Collapsible.jsx';

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? 'DEMO_MAP_ID';

function AreaMap({ family, rows }) {
  const container = useRef(null);
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    const markers = [];
    (async () => {
      try {
        const { Map, Circle } = await loadMaps();
        if (cancelled || !container.current) return;
        const map = new Map(container.current, {
          center: { lat: family.area_lat, lng: family.area_lng }, zoom: 11, mapId: MAP_ID,
          mapTypeControl: false, streetViewControl: false,
        });
        // One circle per shared area, never a pin that could imply a home address.
        const areas = collectAreas(family, rows);
        areas.forEach((area) => {
          markers.push(new Circle({ map, center: area.center, radius: 1000,
            strokeColor: area.own ? '#1a73e8' : '#cf6541', strokeWeight: 2,
            fillColor: area.own ? '#1a73e8' : '#cf6541', fillOpacity: 0.15 }));
        });
      } catch {
        if (!cancelled) setError('The map could not load. You can still compare families above.');
      }
    })();
    return () => { cancelled = true; markers.forEach((marker) => marker.setMap(null)); };
  }, [family.area_lat, family.area_lng, rows]);
  return <>{error ? <p role="alert">{error}</p> : <div ref={container} className="carpool-map" />}
    <p className="cp-help">Circles show general areas, not home locations or exact boundaries. Blue marks your area.</p></>;
}

function collectAreas(family, rows) {
  const areas = new Map();
  [family, ...rows].forEach((row, index) => {
    const key = `${row.area_lat},${row.area_lng}`;
    if (!areas.has(key)) areas.set(key, { center: { lat: row.area_lat, lng: row.area_lng }, own: index === 0 });
  });
  return areas;
}

export default function MapView({ family, isPending, reloadKey = 0 }) {
  const [rows, setRows] = useState([]);
  const [count, setCount] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');
    // Never fall back to the old directory: it does not enforce reciprocal pause.
    (isPending ? fetchAreaCount() : fetchNearby()).then((result) => {
      if (cancelled) return;
      if (isPending) setCount(result);
      else setRows(result);
    }).catch(() => {
      if (!cancelled) setError('We could not load nearby families. Please try again.');
    }).finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [family.user_id, isPending, reloadKey, retry]);

  return <section className="cp-subblock" aria-labelledby="cp-nearby-title">
    <h2 className="cp-h3" id="cp-nearby-title">{isPending ? 'Your nearby families' : 'Explore nearby families'}</h2>
    {loading && <p className="cp-loading">Loading nearby families</p>}
    {error && <p role="alert">{error} <button type="button" className="cp-btn cp-btn--quiet" onClick={() => setRetry((n) => n + 1)}>Try again</button></p>}
    {!loading && !error && isPending && <p>{count > 0 ? `${count} families in your area. You can explore nearby families once you are approved.` : 'Once you are approved, you can see whether there are families near you.'}</p>}
    {!loading && !error && !isPending && (rows.length ? <>
      <p className="cp-help">Distances are approximate, measured between general areas, not driving routes.</p>
      <ul className="carpool-nearby-list">
        {rows.map((f) => <li key={f.user_id}>
          <p className="cp-item-name">{f.parent_name}</p>
          <p className="cp-item-meta">Area {f.area_label} · about {f.distance_miles.toFixed(1)} mi between areas</p>
          <p className="cp-overlap">{scheduleOverlap(family, f)}</p>
        </li>)}
      </ul>
    </> : <div className="cp-empty"><p>No active families in your search area yet. You can adjust your search distance in Your account below, or check back as more families join.</p></div>)}
    {!loading && !error && <Collapsible id="cp-area-map" title="View nearby areas on a map">
      <AreaMap family={family} rows={rows} />
    </Collapsible>}
  </section>;
}
