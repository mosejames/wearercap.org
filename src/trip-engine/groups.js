// These trips share one gallery without a family-facing upload group.
const SINGLE_GALLERY_TRIPS = new Set(['washington-dc-2030']);
export function usesGroups(trip) {
  return !SINGLE_GALLERY_TRIPS.has(trip?.slug) && (trip?.groups || []).some(group => group !== 'Mixed');
}
export function uploadGroup(trip, selected) {
  // Keep the existing storage contract while omitting grouping from this trip's UI.
  return usesGroups(trip) ? selected : 'Mixed';
}
