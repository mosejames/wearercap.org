import { useEffect, useRef, useState } from 'react';
import { loadMaps, loadMarker } from '../maps.js';
import { fetchDirectory, fetchNearby, fetchAreaCount, rankNearby, isMissingRpcError } from '../directory.js';

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

export default function MapView({ family, isPending, reloadKey = 0 }) {
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
          // Approved parent: the radius-scoped near-you list. Prefer the
          // server-ranked nearby_families() RPC (migration 0009): rows arrive
          // already filtered to the caller's effective radius and sorted
          // nearest-first, each carrying distance_miles and
          // distance_to_school_miles. listRows feed the list; pinFamilies are
          // plotted on the map.
          let listRows;
          let pinFamilies;
          try {
            const scoped = await fetchNearby();
            if (cancelled) return;
            listRows = scoped.map((f) => ({
              ...f,
              distanceMiles: f.distance_miles,
              schoolMiles: f.distance_to_school_miles,
            }));
            // The RPC already excludes the caller and everything outside radius,
            // so the in-radius list IS what belongs on the map.
            pinFamilies = listRows;
          } catch (err) {
            // TEMPORARY BRIDGE — remove once migration 0009 is applied. Until
            // the RPC exists, fetchNearby throws; fall back to the pre-0009
            // behavior (flat family_directory() + client-side rankNearby) so
            // the map is not blank in the window between shipping this code and
            // applying the migration. Only the narrow missing-function case
            // degrades; every other error still surfaces as today.
            if (!isMissingRpcError(err)) throw err;
            const directoryRows = await fetchDirectory();
            if (cancelled) return;
            pinFamilies = directoryRows.filter((f) => f.user_id !== family.user_id);
            listRows = rankNearby(family, directoryRows);
          }

          // Group by centroid; jitter only families sharing the exact same area coordinates
          const grouped = {};
          pinFamilies.forEach((f) => {
            const key = `${f.area_lat},${f.area_lng}`;
            if (!grouped[key]) grouped[key] = [];
            grouped[key].push(f);
          });

          // Render each group, sorting deterministically by user_id
          Object.values(grouped).forEach((group) => {
            group.sort((a, b) => a.user_id.localeCompare(b.user_id));
            group.forEach((f, withinGroupIndex) => {
              const pos = jitter(f.area_lat, f.area_lng, withinGroupIndex);
              const pin = new PinElement({ background: '#ea4335', borderColor: '#8f1c11', glyphColor: '#ffffff' });
              new AdvancedMarkerElement({
                map,
                position: pos,
                content: pin.element,
                title: f.parent_name,
              });
            });
          });
          setRows(listRows);
        }
      } catch (err) {
        if (!cancelled) setError(err.message ?? 'Could not load the map.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => { cancelled = true; };
    // reloadKey lets the parent force a refetch (e.g. after the radius changes)
    // so the scoped list and pins reflect the new radius immediately.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [family.user_id, isPending, reloadKey]);

  return (
    <section className="cp-subblock">
      <p className="cp-label cp-label--bar">Families near you</p>
      <div ref={mapContainerRef} className="carpool-map" />
      {error && <p role="alert">{error}</p>}
      {loading && !error && <p className="cp-loading cp-after-map">Loading the map</p>}

      {!loading && !error && isPending && (
        <div className="cp-note cp-after-map">
          <p>
            {count > 0
              ? `${count} famil${count === 1 ? 'y' : 'ies'} already in your area. They'll appear on the map once you're approved.`
              : "You're the first family in your area. Invite a neighbor."}
          </p>
        </div>
      )}

      {!loading && !error && !isPending && (
        rows.length === 0 ? (
          <div className="cp-empty cp-after-map">
            <p>No families within your area yet. As more RCA families join nearby, they will show up here.</p>
          </div>
        ) : (
          <ul className="carpool-nearby-list cp-after-map">
            {rows.map((f) => (
              <li key={f.user_id}>
                <p className="cp-item-name">{f.parent_name}</p>
                <p className="cp-item-meta">{f.child_names}</p>
                <p className="cp-item-meta">
                  {f.area_label} · {scheduleText(f)} · {f.distanceMiles.toFixed(1)} mi
                  {f.schoolMiles != null && ` · ${f.schoolMiles.toFixed(0)} mi from school`}
                </p>
              </li>
            ))}
          </ul>
        )
      )}
    </section>
  );
}
