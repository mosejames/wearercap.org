import { useEffect, useRef, useState } from 'react';
import { loadMaps, loadMarker } from '../maps.js';
import { fetchDirectory, fetchAreaCount, rankNearby } from '../directory.js';

const MAP_ID = import.meta.env.VITE_GOOGLE_MAPS_MAP_ID ?? 'DEMO_MAP_ID';

// Small deterministic offset so families sharing a ZIP centroid don't render
// as a single stacked pin. Display only — never written back to the DB.
const JITTER_DEGREES = 0.002;
function jitter(lat, lng, index) {
  if (index === 0) return { lat, lng };
  const angle = (index * 137.5 * Math.PI) / 180; // golden-angle spread
  return {
    lat: lat + JITTER_DEGREES * Math.cos(angle),
    lng: lng + JITTER_DEGREES * Math.sin(angle),
  };
}

function scheduleText(family) {
  const when = family.direction === 'both' ? 'Morning & afternoon' : family.direction === 'am' ? 'Morning' : 'Afternoon';
  return `${when} · ${family.weekdays.join(', ')}`;
}

export default function MapView({ family, isPending }) {
  const mapContainerRef = useRef(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [count, setCount] = useState(null);
  const [rows, setRows] = useState([]);

  useEffect(() => {
    let cancelled = false;

    (async () => {
      try {
        const [{ Map }, { AdvancedMarkerElement, PinElement }] = await Promise.all([loadMaps(), loadMarker()]);
        if (cancelled || !mapContainerRef.current) return;

        const map = new Map(mapContainerRef.current, {
          center: { lat: family.area_lat, lng: family.area_lng },
          zoom: 11,
          mapId: MAP_ID,
        });

        // The caller's own pin, visually distinct from everyone else's.
        const ownPin = new PinElement({ background: '#1a73e8', borderColor: '#0b3d91', glyphColor: '#ffffff' });
        new AdvancedMarkerElement({
          map,
          position: { lat: family.area_lat, lng: family.area_lng },
          content: ownPin.element,
          title: 'You',
        });

        if (isPending) {
          const n = await fetchAreaCount();
          if (cancelled) return;
          setCount(n);
        } else {
          const directoryRows = await fetchDirectory();
          if (cancelled) return;
          const others = directoryRows.filter((f) => f.user_id !== family.user_id);
          others.forEach((f, i) => {
            const pos = jitter(f.area_lat, f.area_lng, i);
            const pin = new PinElement({ background: '#ea4335', borderColor: '#8f1c11', glyphColor: '#ffffff' });
            new AdvancedMarkerElement({
              map,
              position: pos,
              content: pin.element,
              title: f.parent_name,
            });
          });
          setRows(rankNearby(family, directoryRows));
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Could not load the map.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family.user_id, isPending]);

  return (
    <div>
      <div ref={mapContainerRef} className="carpool-map" />
      {error && <p role="alert">{error}</p>}
      {loading && !error && <p>Loading map…</p>}

      {!loading && isPending && (
        <p>
          {count > 0
            ? `${count} famil${count === 1 ? 'y' : 'ies'} already in your area — they'll appear on the map when you're approved.`
            : "You're the first in your area — invite a neighbor!"}
        </p>
      )}

      {!loading && !isPending && (
        rows.length === 0 ? (
          <p>No other families in your area yet — check back soon.</p>
        ) : (
          <ul className="carpool-nearby-list">
            {rows.map((f) => (
              <li key={f.user_id}>
                <strong>{f.parent_name}</strong> — {f.child_names}
                <br />
                {f.area_label} · {scheduleText(f)} · {f.distanceMiles.toFixed(1)} mi
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
