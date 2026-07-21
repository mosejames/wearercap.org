// Suggested crews (Phase B of proximity matching). Pure, viewer-centric, no I/O.
//
// A "crew" is the handful of families closest to the caller, presented as a
// startable carpool. It is not a stored entity and it auto-adds nobody: the
// caller still creates the group and the crew families still discover it through
// their own radius-scoped "Groups near you". Everything here is plain geography
// plus a name lookup, no model, no server call.

// ZIP -> place name for the metro-Atlanta / RCA catchment. Deliberately small
// and hand-curated: these are the ZIPs families in this app actually sit in, and
// a wrong-but-confident place name is worse than the honest "Families near you"
// fallback. Easy to extend, add a "'ZIP': 'Place'," line as new areas appear.
// A future upgrade would replace this with real reverse-geocoding of the area
// centroid, which would drop the need to maintain this table by hand.
const ZIP_TO_PLACE = {
  // College Park (RCA's own side of the metro)
  '30337': 'College Park',
  '30349': 'College Park',
  // East Point
  '30344': 'East Point',
  '30035': 'Decatur',
  // Atlanta
  '30310': 'Atlanta',
  '30311': 'Atlanta',
  '30315': 'Atlanta',
  '30354': 'Atlanta',
  '30288': 'Atlanta',
  // Decatur
  '30030': 'Decatur',
  '30032': 'Decatur',
  '30034': 'Decatur',
  // Conyers
  '30012': 'Conyers',
  '30013': 'Conyers',
  '30094': 'Conyers',
  // South metro
  '30260': 'Morrow',
  '30274': 'Riverdale',
  '30281': 'Stockbridge',
  // Sensible neighbors of the above, same catchment
  '30296': 'Riverdale',
  '30297': 'Forest Park',
  '30291': 'Union City',
  '30213': 'Fairburn',
};

// Pull a 5-digit ZIP out of a label. area_label is a bare ZIP string today
// (e.g. "30349"), but tolerate a richer "City, GA 30349" form so a later label
// change does not silently break crew naming.
function zipOf(label) {
  const match = String(label ?? '').match(/\d{5}/);
  return match ? match[0] : '';
}

// crewLabel(areaLabels) -> string.
// areaLabels is the crew families' area_label values (ZIP strings), in
// nearest-first order. Find the dominant (most common) ZIP, map it to a place
// name, and return "<Place> crew". Ties are broken toward the ZIP that appears
// first, which is the nearest family since rows arrive nearest-first. An unknown
// dominant ZIP, or an empty list, yields "Families near you".
export function crewLabel(areaLabels) {
  const counts = new Map();
  (areaLabels ?? []).forEach((label) => {
    const zip = zipOf(label);
    if (!zip) return;
    // First-seen order is preserved by Map insertion order, so the first tied
    // ZIP naturally wins the max scan below without a separate index to track.
    counts.set(zip, (counts.get(zip) ?? 0) + 1);
  });

  let dominantZip = '';
  let best = 0;
  for (const [zip, count] of counts) {
    if (count > best) {
      best = count;
      dominantZip = zip;
    }
  }

  const place = ZIP_TO_PLACE[dominantZip];
  return place ? `${place} crew` : 'Families near you';
}

// suggestCrew(nearbyRows, opts) -> { families, label } | null.
// nearbyRows is fetchNearby() output: the caller's in-radius families,
// nearest-first, each carrying distance_miles. Take those within crewRadiusMiles
// (a two-family carpool is legitimate, so one qualifier is enough), keep the
// nearest-first order, cap at max, and label by dominant ZIP. If none qualify,
// there is no crew to suggest, so return null.
export function suggestCrew(nearbyRows, { crewRadiusMiles = 5, max = 8 } = {}) {
  const families = (nearbyRows ?? [])
    .filter((f) => typeof f.distance_miles === 'number' && f.distance_miles <= crewRadiusMiles)
    .slice(0, max);

  if (families.length === 0) return null;

  return { families, label: crewLabel(families.map((f) => f.area_label)) };
}
